#version 300 es
precision highp float;

in vec4 SemispherePosition;
in vec4 SemisphereNormal;

uniform mat4 uSemisphereModel;
uniform mat4 uSemisphereView;
uniform mat4 uSemisphereProjection;

// mode: 1 = refraction, 2 = reflection
uniform int mode;

uniform samplerCube uEnvCubemapSampler; // dynamic environment cubemap
uniform float eta; // refractive index ratio

out vec4 fColor;

void main() {

    // transform into world space
    vec3 P = (uSemisphereModel * SemispherePosition).xyz;
    vec3 N = normalize((uSemisphereModel * SemisphereNormal).xyz);
    // center of semisphere
    vec3 C = (uSemisphereModel * vec4 (0.0, 0.0, 0.0, 1.0)).xyz;

    // get camera position in world space by extracting the translation column of the inverse of the view matrix
    vec3 cameraPos = inverse(uSemisphereView)[3].xyz;

    // incident vector: from surface point towards camera
    vec3 I = normalize(cameraPos - P);

    // compute 1st refraction direction
    vec3 R1 = refract(I, N, eta);

    // check for total internal reflection
    if(length(R1) < 0.001) {
        R1 = reflect(I, N);
    }
    R1 = normalize(R1);

    // solve to find exit point
    float t = -2.0 * dot((P - C), R1);

    // compute exit point
    vec3 P_exit = P + R1 * t;

    // find exit normal vector
    vec3 N_exit;
    if(P_exit.y <= C.y) { // light ray exited through flat disk part of semisphere
        N_exit = vec3(0.0, -1.0, 0.0);
    } else { // light ray exited through spherical part of semisphere
        N_exit = normalize(P_exit - C);
    }

    // compute 2nd refraction direction
    vec3 R2 = refract(R1, N_exit, 1.0 / eta); // inverse eta when glass -> air

    // check for total internal reflection
    if (length(R2) < 0.001) {
        R2 = reflect(R1, N_exit);
    }
    R2 = normalize(R2);

    vec4 envColor;

    if (mode == 1) {
        // pure refraction
        envColor = texture(uEnvCubemapSampler, R2);
    } else if (mode == 2) {
        // pure reflection
        envColor = texture(uEnvCubemapSampler, reflect(-I, N));
    }

    fColor = envColor;
}
