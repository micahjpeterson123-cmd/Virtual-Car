#version 300 es
precision mediump float;

in vec4 vPosition;
in vec4 vColor;
in vec4 vNormal;
in vec4 vSpecularColor;
in float vSpecularExponent;

uniform mat4 model_view;
uniform mat4 projection;

out vec4 Position;
out vec4 color;
out vec4 Normal;
out vec4 SpecularColor;
out float SpecularExponent;

void main() {
    gl_Position = projection * model_view * vPosition;
    Position = vPosition;
    color = vColor;
    Normal = vNormal;
    SpecularColor = vSpecularColor;
    SpecularExponent = vSpecularExponent;
}
