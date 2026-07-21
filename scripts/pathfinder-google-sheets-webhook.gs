const SPREADSHEET_ID = "1YON11nXJr0d0o0nbx0bsYmvWzsC44IxnNqaU7eU56LI";
const SHEET_NAME = "Applications";
const PHOTO_FOLDER_NAME = "Pathfinder Applicant Photos";
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function doGet() {
  return jsonResponse({
    ok: true,
    service: "Melanated Adventurers Pathfinder Applications",
  });
}

function doPost(event) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const payload = parsePayload(event);
    validateSecret(payload.secret);
    validatePayload(payload);

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet tab '${SHEET_NAME}' was not found.`);
    }

    if (findDuplicate(sheet, payload)) {
      return jsonResponse({
        ok: false,
        duplicate: true,
        error: "A Pathfinder application has already been submitted with this email address.",
      });
    }

    const photoUrl = payload.photo ? savePhoto(payload) : "";

    sheet.appendRow([
      safeCell(payload.submittedAt || new Date().toISOString()),
      safeCell(payload.firstName),
      safeCell(payload.lastName),
      safeCell(String(payload.email).toLowerCase()),
      safeCell(payload.phone),
      safeCell(payload.city),
      safeCell(payload.state),
      safeCell(payload.socials || ""),
      safeCell(payload.fit),
      safeCell(payload.status || "Requested"),
      Boolean(payload.commitmentAccepted),
      Boolean(payload.marketingOptIn),
      safeCell(photoUrl),
      safeCell(payload.photoCaption || ""),
      "",
    ]);

    SpreadsheetApp.flush();

    return jsonResponse({ ok: true, duplicate: false, photoSaved: Boolean(photoUrl) });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      ok: false,
      duplicate: false,
      error: error instanceof Error ? error.message : "The application could not be saved.",
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {
      // The lock may not have been acquired if the request failed early.
    }
  }
}

function parsePayload(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error("No application data was received.");
  }

  try {
    return JSON.parse(event.postData.contents);
  } catch (_) {
    throw new Error("The application data was not valid JSON.");
  }
}

function validateSecret(receivedSecret) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET") || "";

  if (expectedSecret && receivedSecret !== expectedSecret) {
    throw new Error("Unauthorized submission.");
  }
}

function validatePayload(payload) {
  const requiredText = [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["city", "City"],
    ["state", "State"],
    ["fit", "Pathfinder response"],
  ];

  requiredText.forEach(([key, label]) => {
    if (!String(payload[key] || "").trim()) {
      throw new Error(`${label} is required.`);
    }
  });

  const email = String(payload.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const phone = String(payload.phone).trim();
  if (!/^\+1\d{10}$/.test(phone)) {
    throw new Error("Enter a valid 10-digit US phone number.");
  }

  const state = String(payload.state).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new Error("Select a valid state.");
  }

  if (String(payload.fit).trim().length < 50) {
    throw new Error("The Pathfinder response must be at least 50 characters.");
  }

  if (String(payload.photoCaption || "").trim().length > 300) {
    throw new Error("The photo caption must be 300 characters or fewer.");
  }

  if (payload.photo) {
    validatePhoto(payload.photo);
  }

  if (payload.commitmentAccepted !== true) {
    throw new Error("The Pathfinder Commitment must be accepted.");
  }
}

function validatePhoto(photo) {
  const type = String(photo.type || "");
  const size = Number(photo.size || 0);
  const data = String(photo.data || "");

  if (ALLOWED_PHOTO_TYPES.indexOf(type) === -1) {
    throw new Error("Photo must be a JPG, PNG, or WebP image.");
  }

  if (!size || size > MAX_PHOTO_BYTES || !data) {
    throw new Error("Photo must be 4 MB or smaller.");
  }
}

function savePhoto(payload) {
  const photo = payload.photo;
  validatePhoto(photo);

  const folder = getPhotoFolder();
  const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
  const safeName = `${normalizeFilePart(payload.lastName)}-${normalizeFilePart(payload.firstName)}-${Date.now()}.${extension}`;
  const bytes = Utilities.base64Decode(String(photo.data));
  const blob = Utilities.newBlob(bytes, photo.type, safeName);
  const file = folder.createFile(blob);

  return file.getUrl();
}

function getPhotoFolder() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty("PHOTO_FOLDER_ID");

  if (savedId) {
    try {
      return DriveApp.getFolderById(savedId);
    } catch (_) {
      properties.deleteProperty("PHOTO_FOLDER_ID");
    }
  }

  const matches = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  const folder = matches.hasNext() ? matches.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  properties.setProperty("PHOTO_FOLDER_ID", folder.getId());
  return folder;
}

function normalizeFilePart(value) {
  return String(value || "applicant")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "applicant";
}

function findDuplicate(sheet, payload) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const rows = sheet.getRange(2, 1, lastRow - 1, 15).getDisplayValues();
  const targetEmail = normalize(payload.email);

  return rows.some((row) => normalize(row[3]) === targetEmail);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function safeCell(value) {
  const text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
