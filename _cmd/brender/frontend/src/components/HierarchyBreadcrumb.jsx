import { useTranslation } from 'react-i18next'
import Breadcrumb from './Breadcrumb'
import EntityIcon from './EntityIcon'

// 階層パンくずの唯一の生成元。
//   プロジェクト一覧 › プロジェクト名 › ファイル名 › ワークスペース名 › 実行結果
//
// ページ側は「自分がどの階層にいるか」を ID と名称で渡すだけでよい。
// 渡された最下層が自動的に現在地（リンクなし）になり、上位はすべてリンクになる。
// 上位階層のリンク先は各階層の設定タブ（一覧へ戻るのは .back-to-list ボタンの役割）。
//
// ラベル・アイコン・遷移先をページ側に書かないこと。書くと階層が増減したときに
// ページごとに表現がずれる（実行結果だけアイコンが出ない、等）。
export default function HierarchyBreadcrumb({
  navigate,
  projectID, projectName,
  fileID, fileName,
  workspaceID, workspaceName,
  job = false,
  suffix = {},
}) {
  const { t } = useTranslation()

  const levels = [
    {
      key: 'projects',
      show: true,
      label: t('breadcrumb.projects'),
      go: () => navigate('projects'),
    },
    {
      key: 'project',
      show: !!projectID,
      label: projectName,
      icon: 'project',
      go: () => navigate('project', { id: projectID, initialTab: 'settings' }),
    },
    {
      key: 'file',
      show: !!fileID && !!fileName,
      label: fileName,
      icon: 'file',
      go: () => navigate('file', { projectID, projectName, fileID, fileName, initialTab: 'settings' }),
    },
    {
      key: 'workspace',
      show: !!workspaceID,
      label: workspaceName,
      icon: 'workspace',
      go: () => navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID, workspaceName }),
    },
    {
      key: 'job',
      show: !!job,
      label: t('breadcrumb.jobResult'),
      icon: 'job',
    },
  ].filter(l => l.show)

  const lastIndex = levels.length - 1

  return (
    <Breadcrumb items={levels.map((l, i) => ({
      label:   l.label,
      icon:    l.icon ? <EntityIcon type={l.icon} /> : null,
      onClick: i < lastIndex ? l.go : undefined,
      suffix:  suffix[l.key] || null,
    }))} />
  )
}
