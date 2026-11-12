export interface User {
  id: string;
  name: string;
  email: string;
  role: "Academic / Research Auditor" | "Consumer Advocate" | "Food Brand Compliance Officer";
  organization: string;
  token: string;
  loggedInAt: string;
}

const STORAGE_KEY = "ncv_auth_session";

export const DEMO_USERS: Record<string, { name: string; role: User["role"]; org: string; pass: string }> = {
  "auditor@fssai-audit.ac.in": {
    name: "Dr. Arpita Sen (Lead Auditor)",
    role: "Academic / Research Auditor",
    org: "University Food Lab & URE Project",
    pass: "audit2026",
  },
  "consumer@safefood.org": {
    name: "Priya Sharma",
    role: "Consumer Advocate",
    org: "Consumer Rights Federation India",
    pass: "consumer2026",
  },
  "regulatory@compliance.in": {
    name: "Rajesh Verma",
    role: "Food Brand Compliance Officer",
    org: "Packaged Goods Standards Council",
    pass: "fssai2026",
  },
};

export function getSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user: User = JSON.parse(raw);
    return user;
  } catch (e) {
    return null;
  }
}

export function setSession(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("ncv_auth_change"));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("ncv_auth_change"));
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export async function loginUser(email: string, password: string):Promise<{ success: boolean; user?: User; error?: string }> {
  // Simulate network auth latency
  await new Promise((r) => setTimeout(r, 400));

  const cleanEmail = email.trim().toLowerCase();
  const known = DEMO_USERS[cleanEmail];

  if (known) {
    if (password === known.pass || password === "password" || password === "admin") {
      const user: User = {
        id: `usr_${Date.now()}`,
        name: known.name,
        email: cleanEmail,
        role: known.role,
        organization: known.org,
        token: `jwt_ncv_${Buffer.from(cleanEmail).toString("base64")}_${Date.now()}`,
        loggedInAt: new Date().toISOString(),
      };
      setSession(user);
      return { success: true, user };
    }
    return { success: false, error: "Invalid password for this account. (Default demo password is 'audit2026')" };
  }

  // Allow any valid institutional / professional email for demonstration
  if (cleanEmail.includes("@") && cleanEmail.includes(".")) {
    const role: User["role"] = cleanEmail.includes("audit") || cleanEmail.includes("edu") || cleanEmail.includes("ac.in")
      ? "Academic / Research Auditor"
      : "Consumer Advocate";
    const name = cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const user: User = {
      id: `usr_${Date.now()}`,
      name: name || "Verified Auditor",
      email: cleanEmail,
      role,
      organization: "Research Affiliate / Academic Guest",
      token: `jwt_ncv_${Buffer.from(cleanEmail).toString("base64")}_${Date.now()}`,
      loggedInAt: new Date().toISOString(),
    };
    setSession(user);
    return { success: true, user };
  }

  return { success: false, error: "Please enter a valid email address." };
}

export async function requestAccess(data: {
  name: string;
  email: string;
  organization: string;
  role: User["role"];
  useCase: string;
}): Promise<{ success: boolean; user?: User; error?: string }> {
  await new Promise((r) => setTimeout(r, 500));

  if (!data.name || !data.email || !data.organization) {
    return { success: false, error: "All required fields must be completed." };
  }

  const user: User = {
    id: `usr_${Date.now()}`,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    role: data.role,
    organization: data.organization.trim(),
    token: `jwt_ncv_req_${Date.now()}`,
    loggedInAt: new Date().toISOString(),
  };

  setSession(user);
  return { success: true, user };
}
