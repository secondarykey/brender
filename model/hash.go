package model

import (
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"net"
	"strings"
	"time"
)

func GenerateEnvHash() string {

	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	ip := ""
	for _, addr := range addrs {
		nip, ok := addr.(*net.IPNet)
		if ok && !nip.IP.IsLoopback() {
			if nip.IP.To4() != nil {
				ip = nip.IP.String()
			}
		}
	}

	now := time.Now()
	work := ip + ":" + now.Format("20060102150405") + makeRandString(16)

	sha256 := sha256.Sum256([]byte(work))
	return fmt.Sprintf("%x", sha256)
}

const letter = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func makeRandString(d int) string {

	b := make([]byte, d)
	leng := len(letter)
	if _, err := rand.Read(b); err != nil {
		if d > leng {
			//TODO to short
			return letter
		}
		return letter[:d]
	}

	var builder strings.Builder
	for _, c := range b {
		idx := int(c) % leng
		builder.WriteByte(letter[idx])
	}
	return builder.String()
}
