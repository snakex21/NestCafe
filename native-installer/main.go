package main

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

//go:embed payload/*
var payload embed.FS

func main() {
	if err := run(); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	target := argumentValue(os.Args[1:], "--install-dir")
	if target == "" {
		target = argumentPrefixValue(os.Args[1:], "/D=")
	}
	if target == "" && hasArgument(os.Args[1:], "--updated") {
		// electron-updater uruchamia pobrany instalator z --updated. Gdy stara
		// instalacja była w niestandardowym katalogu, katalog roboczy procesu
		// często nadal wskazuje właśnie tę instalację — wykorzystaj go zamiast
		// ślepo wracać do domyślnej ścieżki.
		if cwd, cwdErr := os.Getwd(); cwdErr == nil {
			if info, statErr := os.Stat(filepath.Join(cwd, "NestCafe.exe")); statErr == nil && !info.IsDir() {
				target = cwd
			}
		}
	}
	if target == "" {
		local := os.Getenv("LOCALAPPDATA")
		if local == "" {
			return errors.New("Brakuje LOCALAPPDATA i nie podano katalogu instalacji")
		}
		target = filepath.Join(local, "Programs", "NestCafe")
	}
	absolute, err := filepath.Abs(target)
	if err != nil {
		return err
	}
	target = absolute

	if argumentValue(os.Args[1:], "--wait-pid") != "" {
		// The native launcher starts the installer and exits immediately. Give
		// Windows a moment to release NestCafe.exe before replacing the folder.
		time.Sleep(1500 * time.Millisecond)
	}

	if err := os.MkdirAll(target, 0o755); err != nil {
		return err
	}
	if err := cleanInstallDirectory(target); err != nil {
		return fmt.Errorf("Nie udało się usunąć starej wersji NestCafe: %w", err)
	}
	if err := extractPayload(target); err != nil {
		return fmt.Errorf("Nie udało się zainstalować nowej wersji NestCafe: %w", err)
	}

	launcher := filepath.Join(target, "NestCafe.exe")
	if _, err := os.Stat(launcher); err != nil {
		return fmt.Errorf("Pakiet aktualizacji nie zawiera NestCafe.exe")
	}
	if hasArgument(os.Args[1:], "--force-run") || !hasArgument(os.Args[1:], "/S") {
		cmd := exec.Command(launcher, "--no-update")
		cmd.Dir = target
		_ = cmd.Start()
	}
	return nil
}

func cleanInstallDirectory(root string) error {
	entries, err := os.ReadDir(root)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		name := entry.Name()
		if strings.EqualFold(name, "supercli-data") {
			continue
		}
		path := filepath.Join(root, name)
		var removeErr error
		for attempt := 0; attempt < 20; attempt++ {
			removeErr = os.RemoveAll(path)
			if removeErr == nil {
				break
			}
			time.Sleep(250 * time.Millisecond)
		}
		if removeErr != nil {
			return removeErr
		}
	}
	return nil
}

func extractPayload(root string) error {
	return fs.WalkDir(payload, "payload", func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == "payload" {
			return nil
		}
		rel := strings.TrimPrefix(path, "payload/")
		if rel == "placeholder.txt" {
			return nil
		}
		if !fs.ValidPath(rel) || rel == "." {
			return fmt.Errorf("Nieprawidłowa ścieżka w pakiecie: %q", rel)
		}
		destination := filepath.Join(root, filepath.FromSlash(rel))
		if entry.IsDir() {
			return os.MkdirAll(destination, 0o755)
		}
		content, err := payload.ReadFile(path)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		return os.WriteFile(destination, content, 0o755)
	})
}

func argumentValue(arguments []string, name string) string {
	for index := 0; index < len(arguments); index++ {
		argument := arguments[index]
		if strings.EqualFold(argument, name) && index+1 < len(arguments) {
			return strings.TrimSpace(arguments[index+1])
		}
		prefix := name + "="
		if len(argument) >= len(prefix) && strings.EqualFold(argument[:len(prefix)], prefix) {
			return strings.TrimSpace(argument[len(prefix):])
		}
	}
	return ""
}

func argumentPrefixValue(arguments []string, prefix string) string {
	for _, argument := range arguments {
		if len(argument) >= len(prefix) && strings.EqualFold(argument[:len(prefix)], prefix) {
			return strings.Trim(strings.TrimSpace(argument[len(prefix):]), `"`)
		}
	}
	return ""
}

func hasArgument(arguments []string, name string) bool {
	for _, argument := range arguments {
		if strings.EqualFold(argument, name) {
			return true
		}
	}
	return false
}
