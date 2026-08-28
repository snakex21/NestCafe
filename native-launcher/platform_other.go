//go:build !windows

package main

import (
	"fmt"
	"os/exec"
)

func configureChild(*exec.Cmd) {}

func showError(title, message string) {
	fmt.Printf("%s: %s\n", title, message)
}
