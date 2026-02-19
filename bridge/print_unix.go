//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// sendToPrinter sends raw BRF bytes to the named printer using CUPS (lp).
// This implementation is used on macOS and Linux.
func sendToPrinter(printerName string, data []byte) error {
	// Write the BRF content to a temporary file.
	tmp, err := os.CreateTemp("", "braillevibe-*.brf")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	defer os.Remove(tmp.Name())

	if _, err := tmp.Write(data); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temp file: %w", err)
	}

	// Use `lp` to send the file to the named printer as a raw job.
	cmd := exec.Command("lp", "-d", printerName, "-o", "raw", tmp.Name())
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("lp command failed: %w\noutput: %s", err, output)
	}

	return nil
}
