// Браузерная часть WebAuthn: перевод опций сервера в ArrayBuffer и ответа обратно в base64url.

export const supported = () => !!(window.PublicKeyCredential && navigator.credentials);

const toBuf = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
};
const toB64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function createPasskey(options) {
  const cred = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: toBuf(options.challenge),
      user: { ...options.user, id: toBuf(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) })),
    },
  });
  return {
    id: cred.id,
    rawId: toB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: toB64url(cred.response.clientDataJSON),
      attestationObject: toB64url(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
  };
}

export async function getPasskey(options) {
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: toBuf(options.challenge),
      rpId: options.rpId,
      userVerification: options.userVerification,
      timeout: options.timeout,
      allowCredentials: [],
    },
  });
  return {
    id: cred.id,
    rawId: toB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: toB64url(cred.response.clientDataJSON),
      authenticatorData: toB64url(cred.response.authenticatorData),
      signature: toB64url(cred.response.signature),
      userHandle: cred.response.userHandle ? toB64url(cred.response.userHandle) : null,
    },
  };
}
