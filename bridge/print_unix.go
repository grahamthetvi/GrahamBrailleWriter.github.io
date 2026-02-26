//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
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

// listPrinters returns printer names visible to CUPS on Linux/macOS.
func listPrinters() []string {
	out, err := exec.Command("lpstat", "-a").Output()
	if err != nil {
		// Fallback: try lpstat with no args
		out, err = exec.Command("lpstat").Output()
		if err != nil {
			return nil
		}
	}
	var result []string
	for _, line := range strings.Split(string(out), "\n") {
		// lpstat -a lines look like: "PrinterName accepting requests..."
		fields := strings.Fields(line)
		if len(fields) > 0 {
			result = append(result, fields[0])
		}
	}
	return result
}
