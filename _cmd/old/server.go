package main

import "github.com/ikascrew/brender/server"

func main() {
	err := server.Listen()
	if err != nil {
		panic(err)
	}
}
