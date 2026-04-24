import { getStore } from "@netlify/blobs";

type RegistrationInput = {
  fullName?: string;
  instagramUsername?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  fanNote?: string;
  idDocument?: string;
  faceCapture?: string;
};

type StoredRegistration = {
  fanId: string;
  fullName: string;
  instagramUsername: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  fanNote?: string;
  status: "pending";
  cardGenerated: boolean;
  cardActivated: boolean;
  idDocumentKey?: string;
  faceCaptureKey?: string;
  createdAt: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function trpcData(data: unknown) {
  return json({ result: { data: { json: data } } });
}

function trpcError(message: string, status = 400) {
  return json({ error: { message } }, status);
}

function randomSegment(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function generateFanId() {
  return `JM-${randomSegment(4)}-${randomSegment(4)}`;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateRegistration(input: RegistrationInput) {
  const fullName = readString(input.fullName);
  const instagramUsername = readString(input.instagramUsername);
  const email = readString(input.email);
  const phone = readString(input.phone);
  const dateOfBirth = readString(input.dateOfBirth);
  const address = readString(input.address);
  const fanNote = readString(input.fanNote);

  if (fullName.length < 2 || fullName.length > 100) return "Full name is required.";
  if (instagramUsername.length < 1 || instagramUsername.length > 50) return "Instagram username is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "A valid email is required.";
  if (phone.length < 5 || phone.length > 20) return "A valid phone number is required.";
  if (!dateOfBirth || Number.isNaN(Date.parse(dateOfBirth))) return "A valid date of birth is required.";
  if (address.length < 5) return "Address is required.";
  if (fanNote.length > 220) return "Fan note must be 220 characters or fewer.";
  return null;
}

function parseDataUrl(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return null;
  const match = value.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Uploads must be PNG or JPEG images.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 7 * 1024 * 1024) {
    throw new Error("Each upload must be smaller than 7 MB.");
  }

  return {
    extension: match[1] === "image/png" ? "png" : "jpg",
    bytes: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

async function handleRegistration(req: Request) {
  if (req.method !== "POST") {
    return trpcError("Method not allowed.", 405);
  }

  const body = await req.json().catch(() => null);
  const input = (body && typeof body === "object" && "json" in body ? body.json : body) as RegistrationInput | null;
  if (!input || typeof input !== "object") {
    return trpcError("Registration details are required.");
  }

  const validationError = validateRegistration(input);
  if (validationError) {
    return trpcError(validationError);
  }

  const fanId = generateFanId();
  const uploads = getStore("fan-uploads");
  const registrations = getStore("fan-registrations");
  let idDocumentKey: string | undefined;
  let faceCaptureKey: string | undefined;

  try {
    const idDocument = parseDataUrl(input.idDocument);
    if (idDocument) {
      idDocumentKey = `${fanId}/id-document.${idDocument.extension}`;
      await uploads.set(idDocumentKey, idDocument.bytes);
    }

    const faceCapture = parseDataUrl(input.faceCapture);
    if (faceCapture) {
      faceCaptureKey = `${fanId}/face-capture.${faceCapture.extension}`;
      await uploads.set(faceCaptureKey, faceCapture.bytes);
    }
  } catch (error) {
    return trpcError(error instanceof Error ? error.message : "Upload could not be saved.");
  }

  const registration: StoredRegistration = {
    fanId,
    fullName: readString(input.fullName),
    instagramUsername: readString(input.instagramUsername),
    email: readString(input.email).toLowerCase(),
    phone: readString(input.phone),
    dateOfBirth: readString(input.dateOfBirth),
    address: readString(input.address),
    fanNote: readString(input.fanNote) || undefined,
    status: "pending",
    cardGenerated: true,
    cardActivated: false,
    idDocumentKey,
    faceCaptureKey,
    createdAt: new Date().toISOString(),
  };

  await registrations.setJSON(`registrations/${fanId}`, registration);

  return trpcData({
    success: true,
    fanId,
    message: "Registration successful. Your Bronze Fan Card has been generated.",
  });
}

export default async function handler(req: Request) {
  const pathname = new URL(req.url).pathname;

  if (pathname === "/api/trpc/ping" || pathname === "/api/ping") {
    return trpcData({ ok: true, ts: Date.now() });
  }

  if (pathname === "/api/trpc/fan.register" || pathname === "/api/register") {
    return handleRegistration(req);
  }

  return json({ error: "Not Found" }, 404);
}

export const config = {
  path: "/api/*",
};
