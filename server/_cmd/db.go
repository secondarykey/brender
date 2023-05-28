package main

import (
	"github.com/ikascrew/brender/model"
)

func main() {
	err := model.Start()
	if err != nil {
		panic(err)
	}
}
