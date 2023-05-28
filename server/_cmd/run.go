package main

import (
	"fmt"
	"github.com/ikascrew/brender"
	"os"
)

func main() {
	jobId, errCh := brender.RunWorkspace("961938b5-d6f4-324d-21fd-7588024bbd6a", 1)
	err := <-errCh
	if err != nil {
		fmt.Fprintf(os.Stderr, "%+v", err)
		os.Exit(1)
	}
	fmt.Println("JobId:", jobId)
}
