{{- define "mockmate.labels" -}}
app.kubernetes.io/name: mockmate
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* Containers run as non-root with no extra privileges. */}}
{{- define "mockmate.securityContext" -}}
allowPrivilegeEscalation: false
runAsNonRoot: true
capabilities: {drop: [ALL]}
{{- end }}

{{/* Env shared by api + worker: the non-secret ConfigMap, then the out-of-band Secret. */}}
{{- define "mockmate.envFrom" -}}
- configMapRef: {name: {{ .Release.Name }}-config}
- secretRef: {name: {{ .Values.secretName }}}
{{- end }}
