package main

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

const uiContractVersion = 1

var version = "dev"

//go:embed ui/*
var bundledUI embed.FS

func main() {
	if err := run(); err != nil {
		appendLauncherLog(err.Error())
		if !booleanArgument(os.Args[1:], "--no-window") {
			showError("NestCafe", err.Error())
		}
		os.Exit(1)
	}
}

func booleanArgument(arguments []string, name string) bool {
	for _, argument := range arguments {
		if argument == name {
			return true
		}
		if strings.HasPrefix(argument, name+"=") {
			value := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(argument, name+"=")))
			return value == "1" || value == "true" || value == "yes" || value == "on"
		}
	}
	return false
}

func run() error {
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("Nie udało się ustalić położenia NestCafe.exe: %w", err)
	}
	root := filepath.Dir(executable)
	dataDir := filepath.Join(root, "supercli-data")
	if override := argumentValue(os.Args[1:], "--data-dir"); override != "" {
		if absolute, absErr := filepath.Abs(override); absErr == nil {
			dataDir = absolute
		}
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("Nie udało się utworzyć katalogu danych: %w", err)
	}
	if !booleanArgument(os.Args[1:], "--no-update") && tryStartUpdate(root) {
		return nil
	}
	engine := filepath.Join(root, "runtime", "NestCafe.exe")
	if err := promotePendingEngine(engine); err != nil {
		return fmt.Errorf("Nie udalo sie zastosowac przygotowanej aktualizacji silnika: %w", err)
	}
	uiDir, err := extractBundledUI(dataDir)
	if err != nil {
		return fmt.Errorf("Nie udało się przygotować interfejsu NestCafe: %w", err)
	}
	if info, statErr := os.Stat(engine); statErr != nil || info.IsDir() {
		return fmt.Errorf("Brakuje wymiennego silnika NestCafe:\n%s\n\nUruchom: build.bat C:\\sciezka\\do\\supercli-web.exe", engine)
	}

	args := []string{
		"--ui-dir", uiDir,
		"--app-name", "NestCafe",
		"--app-profile", "nestcafe",
		"--data-dir", dataDir,
		"--icon", filepath.Join(uiDir, "window.ico"),
	}
	// Arguments are useful for diagnostics and the headless bridge test. Normal
	// desktop launches pass none, so the portable identity above remains the
	// default. Compatibility and parent lifetime are always launcher-owned.
	args = append(args, os.Args[1:]...)
	args = append(args,
		"--require-ui-contract", fmt.Sprint(uiContractVersion),
		"--parent-pid", fmt.Sprint(os.Getpid()),
	)

	logFile, err := openLauncherLog(dataDir)
	if err != nil {
		return err
	}
	defer logFile.Close()
	_, _ = fmt.Fprintf(logFile, "\n=== %s launcher=%s engine=%s ===\n", time.Now().Format(time.RFC3339), version, engine)
	cmd := exec.Command(engine, args...)
	cmd.Dir = root
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.Env = nestCafeEngineEnv(dataDir)
	configureChild(cmd)
	started := time.Now()
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("Nie udało się uruchomić silnika SuperCli: %w", err)
	}
	if err := cmd.Wait(); err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) && exitErr.ExitCode() == 2 && time.Since(started) < 5*time.Second {
			return fmt.Errorf("Ta wersja silnika jest niezgodna z NestCafe. Podmień silnik na nowszy.\n\nSzczegóły: %s", logFile.Name())
		}
		return fmt.Errorf("Silnik SuperCli zakończył działanie z błędem.\n\nSzczegóły: %s", logFile.Name())
	}
	return nil
}

type nativeUpdateManifest struct {
	Version string `json:"version"`
	URL     string `json:"url"`
	SHA256  string `json:"sha256"`
}

func tryStartUpdate(root string) bool {
	if version == "dev" || strings.TrimSpace(version) == "" {
		return false
	}
	client := &http.Client{Timeout: 4 * time.Second}
	req, err := http.NewRequest(http.MethodGet, "https://github.com/snakex21/NestCafe/releases/latest/download/native-update.json", nil)
	if err != nil {
		return false
	}
	req.Header.Set("User-Agent", "NestCafe/"+version)
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}
	var manifest nativeUpdateManifest
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&manifest); err != nil {
		return false
	}
	if !newerVersion(manifest.Version, version) || manifest.URL == "" || len(manifest.SHA256) != 64 {
		return false
	}

	temp := filepath.Join(os.TempDir(), "NestCafe-update-"+sanitizeVersion(manifest.Version)+".exe")
	if err := downloadVerified(client, manifest.URL, temp, manifest.SHA256); err != nil {
		appendLauncherLog("update download failed: " + err.Error())
		return false
	}
	cmd := exec.Command(temp,
		"--install-dir="+root,
		"--wait-pid="+strconv.Itoa(os.Getpid()),
		"--force-run",
		"/S",
	)
	cmd.Dir = os.TempDir()
	if err := cmd.Start(); err != nil {
		appendLauncherLog("update start failed: " + err.Error())
		return false
	}
	return true
}

func downloadVerified(client *http.Client, sourceURL, target, expectedSHA256 string) error {
	req, err := http.NewRequest(http.MethodGet, sourceURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "NestCafe/"+version)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %s", resp.Status)
	}
	file, err := os.Create(target)
	if err != nil {
		return err
	}
	hash := sha256.New()
	_, copyErr := io.Copy(io.MultiWriter(file, hash), io.LimitReader(resp.Body, 512<<20))
	closeErr := file.Close()
	if copyErr != nil {
		_ = os.Remove(target)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(target)
		return closeErr
	}
	actual := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(actual, expectedSHA256) {
		_ = os.Remove(target)
		return fmt.Errorf("nieprawidlowy SHA-256 aktualizacji")
	}
	return nil
}

func newerVersion(candidate, current string) bool {
	parse := func(value string) [3]int {
		value = strings.TrimPrefix(strings.TrimSpace(value), "v")
		value = strings.SplitN(value, "-", 2)[0]
		parts := strings.Split(value, ".")
		var out [3]int
		for i := 0; i < len(out) && i < len(parts); i++ {
			out[i], _ = strconv.Atoi(parts[i])
		}
		return out
	}
	a, b := parse(candidate), parse(current)
	for i := range a {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return false
}

func sanitizeVersion(value string) string {
	value = strings.TrimPrefix(strings.TrimSpace(value), "v")
	var b strings.Builder
	for _, r := range value {
		if (r >= '0' && r <= '9') || r == '.' || r == '-' {
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return "update"
	}
	return b.String()
}

// promotePendingEngine applies the staged runtime left by update-engine.ps1.
// The launcher runs before the engine, so a normal application restart is the
// first safe moment Windows permits replacing the executable.
func promotePendingEngine(engine string) error {
	pending := strings.TrimSuffix(engine, filepath.Ext(engine)) + ".new" + filepath.Ext(engine)
	info, err := os.Stat(pending)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("oczekujaca aktualizacja jest katalogiem: %s", pending)
	}

	backup := engine + ".previous"
	_ = os.Remove(backup)
	hadEngine := false
	if current, statErr := os.Stat(engine); statErr == nil && !current.IsDir() {
		if err := os.Rename(engine, backup); err != nil {
			return err
		}
		hadEngine = true
	} else if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return statErr
	}
	if err := os.Rename(pending, engine); err != nil {
		if hadEngine {
			_ = os.Rename(backup, engine)
		}
		return err
	}
	if hadEngine {
		_ = os.Remove(backup)
	}
	return nil
}

func argumentValue(arguments []string, name string) string {
	for index := 0; index < len(arguments); index++ {
		argument := arguments[index]
		if argument == name && index+1 < len(arguments) {
			return strings.TrimSpace(arguments[index+1])
		}
		if strings.HasPrefix(argument, name+"=") {
			return strings.TrimSpace(strings.TrimPrefix(argument, name+"="))
		}
	}
	return ""
}

// nestCafeEngineEnv prepares environment for the SuperCli engine.
// WebView2 DevTools follow NestCafe "Szczegóły diagnostyczne"
// (ui.debugMode in supercli-data/webgui-settings.json).
// SUPERCLI_DEVTOOLS in the process environment still wins when set.
func nestCafeEngineEnv(dataDir string) []string {
	env := append(os.Environ(), "SUPERCLI_LAUNCHED_BY=NestCafe")
	if strings.TrimSpace(os.Getenv("SUPERCLI_DEVTOOLS")) != "" {
		return env
	}
	if nestCafeDebugModeEnabled(dataDir) {
		env = append(env, "SUPERCLI_DEVTOOLS=1")
	} else {
		env = append(env, "SUPERCLI_DEVTOOLS=0")
	}
	return env
}

func nestCafeDebugModeEnabled(dataDir string) bool {
	path := filepath.Join(dataDir, "webgui-settings.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	// Minimal parse: avoid pulling encoding/json only for one flag.
	// Accept "ui.debugMode": true with optional spaces.
	text := string(raw)
	for _, needle := range []string{
		`"ui.debugMode":true`,
		`"ui.debugMode": true`,
		`"ui.debugMode" : true`,
		`"ui.debugMode":1`,
	} {
		if strings.Contains(text, needle) {
			return true
		}
	}
	return false
}

func extractBundledUI(dataDir string) (string, error) {
	digest, err := bundledUIDigest()
	if err != nil {
		return "", err
	}
	cacheRoot := filepath.Join(dataDir, "nestcafe-ui")
	target := filepath.Join(cacheRoot, digest[:16])
	if info, statErr := os.Stat(filepath.Join(target, "index.html")); statErr == nil && !info.IsDir() {
		return target, nil
	}
	if err := os.MkdirAll(cacheRoot, 0o755); err != nil {
		return "", err
	}
	if err := removeInside(cacheRoot, target); err != nil {
		return "", err
	}
	temporary := target + fmt.Sprintf(".tmp-%d", os.Getpid())
	if err := removeInside(cacheRoot, temporary); err != nil {
		return "", err
	}
	if err := os.MkdirAll(temporary, 0o755); err != nil {
		return "", err
	}
	defer removeInside(cacheRoot, temporary)
	if err := fs.WalkDir(bundledUI, "ui", func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if name == "ui" {
			return nil
		}
		relative := strings.TrimPrefix(name, "ui/")
		if !fs.ValidPath(relative) || relative == "." {
			return fmt.Errorf("nieprawidłowa ścieżka interfejsu: %q", name)
		}
		destination := filepath.Join(temporary, filepath.FromSlash(relative))
		if entry.IsDir() {
			return os.MkdirAll(destination, 0o755)
		}
		content, err := bundledUI.ReadFile(name)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		return os.WriteFile(destination, content, 0o644)
	}); err != nil {
		return "", err
	}
	if _, err := os.Stat(filepath.Join(temporary, "index.html")); err != nil {
		return "", fmt.Errorf("osadzony interfejs nie zawiera index.html")
	}
	if err := os.Rename(temporary, target); err != nil {
		if info, statErr := os.Stat(filepath.Join(target, "index.html")); statErr != nil || info.IsDir() {
			return "", err
		}
	}
	cleanupOldUICaches(cacheRoot, target)
	return target, nil
}

func bundledUIDigest() (string, error) {
	var names []string
	if err := fs.WalkDir(bundledUI, "ui", func(name string, entry fs.DirEntry, err error) error {
		if err == nil && !entry.IsDir() {
			names = append(names, name)
		}
		return err
	}); err != nil {
		return "", err
	}
	sort.Strings(names)
	hash := sha256.New()
	for _, name := range names {
		content, err := bundledUI.ReadFile(name)
		if err != nil {
			return "", err
		}
		_, _ = hash.Write([]byte(name))
		_, _ = hash.Write([]byte{0})
		_, _ = hash.Write(content)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func cleanupOldUICaches(root, current string) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	current = filepath.Clean(current)
	for _, entry := range entries {
		candidate := filepath.Join(root, entry.Name())
		if filepath.Clean(candidate) == current {
			continue
		}
		_ = removeInside(root, candidate)
	}
}

func removeInside(root, target string) error {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return err
	}
	targetAbs, err := filepath.Abs(target)
	if err != nil {
		return err
	}
	prefix := strings.TrimRight(rootAbs, `\/`) + string(os.PathSeparator)
	if !strings.HasPrefix(strings.ToLower(targetAbs), strings.ToLower(prefix)) {
		return fmt.Errorf("odmowa usunięcia ścieżki spoza cache: %s", targetAbs)
	}
	return os.RemoveAll(targetAbs)
}

func openLauncherLog(dataDir string) (*os.File, error) {
	logs := filepath.Join(dataDir, "logs")
	if err := os.MkdirAll(logs, 0o755); err != nil {
		return nil, fmt.Errorf("Nie udało się utworzyć katalogu logów: %w", err)
	}
	path := filepath.Join(logs, "nestcafe-launcher.log")
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, fmt.Errorf("Nie udało się otworzyć logu launchera: %w", err)
	}
	return file, nil
}

func appendLauncherLog(message string) {
	executable, err := os.Executable()
	if err != nil {
		return
	}
	dataDir := filepath.Join(filepath.Dir(executable), "supercli-data")
	file, err := openLauncherLog(dataDir)
	if err != nil {
		return
	}
	defer file.Close()
	_, _ = fmt.Fprintf(file, "%s ERROR %s\n", time.Now().Format(time.RFC3339), message)
}
