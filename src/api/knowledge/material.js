import request from '@/utils/request'

export const getMaterialCandidates = (id, params) => request({
  url: `/knowledge/material/${encodeURIComponent(id)}/candidates`, method: 'get', params
})
export const validateMaterial = id => request({ url: `/knowledge/material/${encodeURIComponent(id)}/validate`, method: 'get' })
export const getMaterialComparison = (id, params) => request({
  url: `/knowledge/material/${encodeURIComponent(id)}/comparison`, method: 'get', params
})
