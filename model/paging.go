package model

type Paging struct {
	Current int `json:"current"`
	Count   int `json:"count"`
	Limit   int `json:"limit"`
}
