package log_test

import (
	"context"
	"testing"

	"github.com/secondarykey/brender/log"
)

func TestInit(t *testing.T) {
	_, err := log.Init(context.Background())
	if err != nil {
		t.Fatalf("log.Init() error: %v", err)
	}
	defer log.Close()

	log.Error("%s %s", "test", "test")

}
