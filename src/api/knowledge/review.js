import request from '@/utils/request'

const segment = value => encodeURIComponent(String(value))
const post = (url, data) => request({ url: `/knowledge${url}`, method: 'post', data, headers: { repeatSubmit: false } })
export const getQuestionReadiness = id => request({ url: `/knowledge/question/${segment(id)}/readiness`, method: 'get' })
export const approveQuestion = (id, data) => post(`/question/${segment(id)}/approve`, data)
export const returnQuestionToDraft = (id, data) => post(`/question/${segment(id)}/return-to-draft`, data)
export const softDeleteQuestion = (id, data) => post(`/question/${segment(id)}/soft-delete`, data)
export const restoreQuestion = (id, data) => post(`/question/${segment(id)}/restore`, data)
export const approveQuestions = data => post('/question/approve-batch', data)
export const approveGranularityException = data => post('/question/granularity-exceptions', data)
export const getReviewCandidate = (runId, candidateKey) => request({
  url: `/knowledge/review/runs/${segment(runId)}/candidates/${segment(candidateKey)}`, method: 'get'
})
