#version 300 es
precision highp float;

in vec4 vSemispherePosition;
in vec4 vSemisphereNormal;

uniform mat4 uSemisphereModel;
uniform mat4 uSemisphereView;
uniform mat4 uSemisphereProjection;

out vec4 SemispherePosition;
out vec4 SemisphereNormal;

void main() {
    gl_Position = uSemisphereProjection * uSemisphereView * uSemisphereModel * vSemispherePosition;
    SemispherePosition = vSemispherePosition;
    SemisphereNormal = vSemisphereNormal;
}