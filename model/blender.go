package model

import "golang.org/x/xerrors"

type BlenderInstall struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Path      string `json:"path"`
	Version   string `json:"version"`
	Name      string `json:"name"`
	SortOrder int    `json:"sort_order"`
	MetaFields
}

func GetBlenderInstall(id uint) (*BlenderInstall, error) {
	var b BlenderInstall
	res := db.First(&b, id)
	if res.Error != nil {
		return nil, xerrors.Errorf("GetBlenderInstall: %w", res.Error)
	}
	return &b, nil
}

func FirstBlender() (*BlenderInstall, error) {
	var b BlenderInstall
	res := db.Order("sort_order, id").First(&b)
	if res.Error != nil {
		return nil, xerrors.Errorf("FirstBlender: %w", res.Error)
	}
	return &b, nil
}

func ListBlenders() ([]*BlenderInstall, error) {
	var list []*BlenderInstall
	res := db.Order("sort_order, id").Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListBlenders error: %w", res.Error)
	}
	return list, nil
}

func AddBlenderInstall(path, version, name string) (*BlenderInstall, error) {
	var maxOrder int
	db.Model(&BlenderInstall{}).Select("COALESCE(MAX(sort_order), 0)").Scan(&maxOrder)

	b := &BlenderInstall{
		Path:      path,
		Version:   version,
		Name:      name,
		SortOrder: maxOrder + 1,
	}
	res := db.Create(b)
	if res.Error != nil {
		return nil, xerrors.Errorf("AddBlenderInstall error: %w", res.Error)
	}
	return b, nil
}

func RemoveBlenderInstall(id uint) error {
	res := db.Delete(&BlenderInstall{}, id)
	if res.Error != nil {
		return xerrors.Errorf("RemoveBlenderInstall error: %w", res.Error)
	}
	return nil
}

func ReorderBlenders(ids []uint) error {
	for i, id := range ids {
		res := db.Model(&BlenderInstall{}).Where("id = ?", id).Update("sort_order", i)
		if res.Error != nil {
			return xerrors.Errorf("ReorderBlenders error: %w", res.Error)
		}
	}
	return nil
}
