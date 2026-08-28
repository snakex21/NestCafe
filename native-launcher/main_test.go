package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestArgumentValue(t *testing.T) {
	if got := argumentValue([]string{"--data-dir", `C:\Data`, "--echo"}, "--data-dir"); got != `C:\Data` {
		t.Fatalf("separate value = %q", got)
	}
	if got := argumentValue([]string{`--data-dir=C:\Portable`}, "--data-dir"); got != `C:\Portable` {
		t.Fatalf("inline value = %q", got)
	}
}

func TestHardProtocolLongChatRenderingIsThrottled(t *testing.T) {
	root := filepath.Join("..", "native-ui")
	execution, err := os.ReadFile(filepath.Join(root, "js", "chat", "execution.js"))
	if err != nil {
		t.Fatal(err)
	}
	app, err := os.ReadFile(filepath.Join(root, "js", "core", "app.js"))
	if err != nil {
		t.Fatal(err)
	}
	css, err := os.ReadFile(filepath.Join(root, "css", "app.css"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"function scheduleMessageRender(container)",
		"length > 48000 ? 250",
		"container._renderTimer = setTimeout",
		"nestcafe:message-rendered",
		"chat().finalizeMessage?.(current)",
		"liveTurnAppend = true",
		".classList.add(\"live-turn\")",
	} {
		if !strings.Contains(string(execution), required) && !strings.Contains(string(app), required) {
			t.Fatalf("long-chat render guard missing %q", required)
		}
	}
	for _, required := range []string{
		"conversationScrollFrame !== null",
		"new ResizeObserver(() => scrollConversation())",
		"function observeLiveConversationNode(node)",
		"liveConversationResizeObserver.observe(node)",
		"resetLiveConversationObserver()",
		"content-visibility: auto",
		"contain-intrinsic-size: auto 90px",
		".conversation > .live-turn { content-visibility: visible; }",
		"scroll-behavior: auto",
	} {
		if !strings.Contains(string(app), required) && !strings.Contains(string(css), required) {
			t.Fatalf("long-chat layout guard missing %q", required)
		}
	}
}

func TestAssistantProseBeforeToolCallIsPreserved(t *testing.T) {
	root := filepath.Join("..", "native-ui")
	execution, err := os.ReadFile(filepath.Join(root, "js", "chat", "execution.js"))
	if err != nil {
		t.Fatal(err)
	}
	app, err := os.ReadFile(filepath.Join(root, "js", "core", "app.js"))
	if err != nil {
		t.Fatal(err)
	}
	for name, source := range map[string][]byte{"execution.js": execution, "app.js": app} {
		if strings.Contains(string(source), "suppressIntermediateMessage") {
			t.Fatalf("%s still deletes assistant prose when a tool call follows", name)
		}
	}
	if !strings.Contains(string(app), `chat().finalizeMessage?.(current)`) {
		t.Fatal("tool-call boundary no longer finalizes the preceding assistant prose")
	}
}

func TestPromotePendingEngine(t *testing.T) {
	runtimeDir := t.TempDir()
	engine := filepath.Join(runtimeDir, "NestCafe.exe")
	pending := filepath.Join(runtimeDir, "NestCafe.new.exe")
	if err := os.WriteFile(engine, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(pending, []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := promotePendingEngine(engine); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(engine)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "new" {
		t.Fatalf("engine=%q, want staged update", got)
	}
	if _, err := os.Stat(pending); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("pending engine still exists: %v", err)
	}
}

func TestBooleanArgument(t *testing.T) {
	for _, args := range [][]string{{"--no-window"}, {"--no-window=true"}, {"--no-window=1"}} {
		if !booleanArgument(args, "--no-window") {
			t.Fatalf("booleanArgument(%q) = false", args)
		}
	}
	if booleanArgument([]string{"--no-window=false"}, "--no-window") {
		t.Fatal("explicit false enabled no-window")
	}
}

func TestBundledUIDigestIsStable(t *testing.T) {
	first, err := bundledUIDigest()
	if err != nil {
		t.Fatal(err)
	}
	second, err := bundledUIDigest()
	if err != nil {
		t.Fatal(err)
	}
	if first != second || len(first) != 64 {
		t.Fatalf("digest = %q then %q", first, second)
	}
}

func TestRemoveInsideRejectsOutsidePath(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(filepath.Dir(root), "outside")
	err := removeInside(root, outside)
	if err == nil || !strings.Contains(err.Error(), "spoza cache") {
		t.Fatalf("removeInside error = %v", err)
	}
}
