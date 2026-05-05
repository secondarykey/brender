module github.com/ikascrew/brender

replace github.com/ikascrew/brender/core/exec => ./core/exec

go 1.21.0

require (
	github.com/BurntSushi/graphics-go v0.0.0-20160129215708-b43f31a4a966
	github.com/google/uuid v1.6.0
	golang.org/x/image v0.15.0
	golang.org/x/term v0.18.0
	golang.org/x/xerrors v0.0.0-20231012003039-104605ab7028
	gorm.io/driver/sqlite v1.5.5
	gorm.io/gorm v1.25.9
)

require (
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/mattn/go-sqlite3 v1.14.22 // indirect
	golang.org/x/sys v0.18.0 // indirect
)
