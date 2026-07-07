{{- define "recallq.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "recallq.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "recallq.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "recallq.labels" -}}
app.kubernetes.io/name: {{ include "recallq.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
