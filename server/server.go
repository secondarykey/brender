package server

import (
	"fmt"
	"log"
	"net/http"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/server/handler"
)

func Listen() error {

	//ロックファイルをすべて削除
	err := exec.RemoveLockFiles()
	if err != nil {
		log.Println(err)
	}

	serv := ":8080"
	fmt.Println("Listen:", serv)

	return http.ListenAndServe(serv, handler.CreateMux())
}
