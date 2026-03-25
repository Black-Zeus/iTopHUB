import users from "@data/user.json";

const USER_STORAGE_KEY = "itophub-user";
const TOKEN_STORAGE_KEY = "itophub-token";

function sanitizeUser(userRecord) {
  return {
    id: userRecord.id,
    username: userRecord.username,
    apiCode: userRecord.apiCode,
    name: userRecord.name,
    email: userRecord.email,
    role: userRecord.role,
    status: userRecord.status,
  };
}

function buildSession(userRecord) {
  return {
    user: sanitizeUser(userRecord),
    token: userRecord.apiCode,
  };
}

export async function authenticateUser(credentials) {
  const username = credentials.username.trim().toLowerCase();
  const password = credentials.password;

  const matchedUser = users.find((userRecord) => {
    const sameUsername = userRecord.username.toLowerCase() === username;
    const sameEmail = userRecord.email.toLowerCase() === username;
    return (sameUsername || sameEmail) && userRecord.pass === password;
  });

  if (!matchedUser) {
    throw new Error("Credenciales incorrectas");
  }

  if (matchedUser.status !== "Activo") {
    throw new Error("Usuario sin acceso");
  }

  return buildSession(matchedUser);
}

export function getStoredSession() {
  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    const rawToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!rawUser || !rawToken) {
      return null;
    }

    return {
      user: JSON.parse(rawUser),
      token: rawToken,
    };
  } catch {
    clearStoredSession();
    return null;
  }
}

export function persistSession(session) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
  localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
}

export function clearStoredSession() {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
