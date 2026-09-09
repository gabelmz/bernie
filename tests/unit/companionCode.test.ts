import { describe, it, expect } from 'vitest';
import {
  companionTargetsFor,
  generateCompanion,
  generateSharedSecret,
} from '@/lib/companionCode';

describe('Shared secret', () => {
  it('produces a URL-safe secret of the requested length', () => {
    const secret = generateSharedSecret(24);
    expect(secret).toHaveLength(24);
    expect(secret).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('does not repeat itself', () => {
    expect(generateSharedSecret()).not.toBe(generateSharedSecret());
  });
});

describe('Companion targets', () => {
  it('offers a companion only where a direct call can be blocked', () => {
    expect(companionTargetsFor('sheets')).toEqual(['sheets-apps-script']);
    expect(companionTargetsFor('drive')).toEqual(['drive-apps-script']);
    expect(companionTargetsFor('supabase')).toEqual(['supabase-edge-function']);
    expect(companionTargetsFor('asana')).toEqual([]);
    expect(companionTargetsFor('keepa')).toEqual([]);
  });
});

describe('Google Sheets Apps Script', () => {
  const bundle = generateCompanion('sheets-apps-script', {
    spreadsheetId: 'sheet-123',
    sheetName: 'Imported',
    sharedSecret: 'testsecret',
  });

  it('ships a Code.gs with the deploy steps and wiring notes', () => {
    expect(bundle.files).toHaveLength(1);
    expect(bundle.files[0].name).toBe('Code.gs');
    expect(bundle.files[0].language).toBe('javascript');
    expect(bundle.steps.length).toBeGreaterThan(3);
    expect(bundle.wireUp.some((line) => line.includes('Custom HTTP Saves'))).toBe(true);
  });

  it('bakes in the spreadsheet, tab and secret it was given', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain('"sheet-123"');
    expect(code).toContain('"Imported"');
    expect(code).toContain('var BERNIE_SECRET = "testsecret"');
  });

  it('exposes both a read and a write entry point', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain('function doGet(e)');
    expect(code).toContain('function doPost(e)');
    // The actions Bernie drives it with.
    ['append', 'overwrite', 'clear', 'pull'].forEach((action) => expect(code).toContain(action));
  });

  it('refuses a request whose secret does not match', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain('function authorize_(params)');
    expect(code).toMatch(/Unauthorized: the shared secret did not match/);
  });

  it('reads the header row into keys and writes rows back as a matrix', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain('function readRows_(');
    expect(code).toContain('function toMatrix_(');
    // Blank headers still need a usable key.
    expect(code).toContain("'col_' + (index + 1)");
  });

  it('falls back to the bound spreadsheet when no id is configured', () => {
    const code = generateCompanion('sheets-apps-script', {}).files[0].contents;
    expect(code).toContain("var SPREADSHEET_ID = ''");
    expect(code).toContain('SpreadsheetApp.getActiveSpreadsheet()');
  });
});

describe('Supabase Edge Function', () => {
  const bundle = generateCompanion('supabase-edge-function', {
    table: 'products',
    onConflict: 'asin',
    sharedSecret: 'edgesecret',
  });

  it('ships the function plus its import map', () => {
    expect(bundle.files.map((file) => file.name)).toEqual(['index.ts', 'deno.json']);
    expect(bundle.files[0].language).toBe('typescript');
  });

  it('keeps the service role key on the server', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    // The key is read from the environment, never inlined.
    expect(code).not.toContain('eyJ');
  });

  it('bakes in the table and conflict column it was given', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain('const DEFAULT_TABLE = "products"');
    expect(code).toContain('const DEFAULT_ON_CONFLICT = "asin"');
  });

  it('supports the full read and write surface', () => {
    const code = bundle.files[0].contents;
    ['insert', 'upsert', 'select', 'update', 'delete'].forEach((action) => expect(code).toContain(`'${action}'`));
  });

  it('refuses a bulk update or delete with no filter', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain('Refusing to delete without a filter.');
    expect(code).toContain('Refusing to update without a filter.');
  });

  it('checks the shared secret before doing anything', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain("Deno.env.get('BERNIE_SECRET')");
    expect(code).toContain('Unauthorized: the shared secret did not match.');
  });

  it('tells the user to set the secret and how to wire Bernie up', () => {
    expect(bundle.steps.some((step) => step.includes('supabase secrets set BERNIE_SECRET=edgesecret'))).toBe(true);
    expect(bundle.wireUp.some((line) => line.includes('Invoke an Edge Function'))).toBe(true);
    expect(bundle.wireUp.some((line) => line.includes('"onConflict": "asin"'))).toBe(true);
  });
});

describe('Google Drive Apps Script', () => {
  const bundle = generateCompanion('drive-apps-script', { folderId: 'folder-9', sharedSecret: 'drivesecret' });

  it('lists and writes the configured folder', () => {
    const code = bundle.files[0].contents;
    expect(code).toContain('var FOLDER_ID = "folder-9"');
    expect(code).toContain('DriveApp.getFolderById(FOLDER_ID)');
    expect(code).toContain('function doGet(e)');
    expect(code).toContain('function doPost(e)');
    expect(code).toContain('MimeType.CSV');
  });

  it('uses the Drive root when no folder is configured', () => {
    const code = generateCompanion('drive-apps-script', {}).files[0].contents;
    expect(code).toContain('DriveApp.getRootFolder()');
  });
});

describe('Generated code shape', () => {
  it('generates a secret when none is supplied, and repeats it in the instructions', () => {
    const bundle = generateCompanion('sheets-apps-script', { sheetName: 'Sheet1' });
    const code = bundle.files[0].contents;

    const match = code.match(/var BERNIE_SECRET = "([^"]+)"/);
    expect(match).toBeTruthy();
    const secret = match![1];
    expect(secret.length).toBeGreaterThan(16);

    // The wiring notes must quote the same secret, or the user is stuck.
    expect(bundle.wireUp.join('\n')).toContain(secret);
  });

  it('escapes the values it interpolates', () => {
    const bundle = generateCompanion('sheets-apps-script', { sheetName: 'He said "hi"' });
    const code = bundle.files[0].contents;
    // JSON.stringify keeps the generated JavaScript parseable.
    expect(code).toContain('var DEFAULT_SHEET = "He said \\"hi\\""');
  });
});
