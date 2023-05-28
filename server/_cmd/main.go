package main

import (
	"github.com/ikascrew/brender"
)

func main() {
	err := brender.Listen()
	if err != nil {
		panic(err)
	}
}
