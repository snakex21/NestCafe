//go:build windows

package main

import (
	"os/exec"
	"syscall"
	"unsafe"
)

func configureChild(cmd *exec.Cmd) {
	const createNoWindow = 0x08000000
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
}

func showError(title, message string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBox := user32.NewProc("MessageBoxW")
	text, textErr := syscall.UTF16PtrFromString(message)
	caption, titleErr := syscall.UTF16PtrFromString(title)
	if textErr != nil || titleErr != nil {
		return
	}
	const mbOKIconError = 0x00000010
	_, _, _ = messageBox.Call(
		0,
		uintptr(unsafe.Pointer(text)),
		uintptr(unsafe.Pointer(caption)),
		mbOKIconError,
	)
}
