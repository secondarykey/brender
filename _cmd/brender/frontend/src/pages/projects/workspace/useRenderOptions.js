import { useState, useEffect } from 'react'
import { BlenderApi, CodesApi, EnvironmentApi } from '../../../lib/api'

// ワークスペースの設定フォームが選択肢に使うものを読む。
//   ready            … フォームの値ができたか（できるまでは .blend を読まない）
//   blenderInstallID … フォームで選んでいる Blender
//   fileID           … ワークスペースの .blend。あればシーン・カメラ・エンジンを .blend から読み、
//                      無ければエンジンだけを Blender から読む
// Blender を選び直すと、.blend の解析を読み直す。
export function useRenderOptions(ready, blenderInstallID, fileID) {
  const [blenders, setBlenders]                   = useState([])
  const [cpuCount, setCpuCount]                   = useState(null)
  const [imageFormats, setImageFormats]           = useState([])
  const [resolutionPresets, setResolutionPresets] = useState([])
  const [envOutputFormat, setEnvOutputFormat]     = useState('')
  const [toolData, setToolData]                   = useState(null)
  const [engines, setEngines]                     = useState([])
  const [toolLoading, setToolLoading]             = useState(false)
  const [enginesLoading, setEnginesLoading]       = useState(false)

  useEffect(() => {
    BlenderApi.list().then(list => setBlenders(list || [])).catch(() => {})
    BlenderApi.getCPUCount().then(n => setCpuCount(n)).catch(() => {})
    CodesApi.getImageFormats().then(list => setImageFormats(list || [])).catch(() => {})
    CodesApi.getResolutionPresets().then(list => setResolutionPresets(list || [])).catch(() => {})
    EnvironmentApi.get().then(env => setEnvOutputFormat(env?.output_format || '')).catch(() => {})
  }, [])

  useEffect(() => {
    if (!ready) return
    if (fileID) {
      setToolLoading(true)
      setEnginesLoading(true)
      BlenderApi.getToolData({ installID: blenderInstallID, fileID })
        .then(data => {
          setToolData(data || null)
          setEngines(data?.Engines || [])
        })
        .catch(() => { setToolData(null); setEngines([]) })
        .finally(() => { setToolLoading(false); setEnginesLoading(false) })
    } else {
      setToolData(null)
      setEnginesLoading(true)
      BlenderApi.getEngines({ installID: blenderInstallID })
        .then(list => setEngines(list || []))
        .catch(() => setEngines([]))
        .finally(() => setEnginesLoading(false))
    }
  }, [ready, blenderInstallID, fileID])

  return { blenders, cpuCount, imageFormats, resolutionPresets, envOutputFormat, toolData, engines, toolLoading, enginesLoading }
}
