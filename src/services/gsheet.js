/**
 * Service to interact with Google Sheets via Apps Script Web App
 */

// Replace with your deployed Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxZeLyTT-hteg2Rv9VXI2RwC0QTcjX_PSyiDepd5s-cozdrW2V19m9OFaADc7PXrCZGPg/exec';

// Google Sheets serializes date cells as ISO (e.g. 2026-07-05T17:00:00.000Z).
// Format to plain YYYY-MM-DD in Jakarta time so the day matches what's typed in the sheet.
export const formatSheetDate = (d) => {
  if (typeof d !== 'string' || !d.includes('T')) return d;
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};

export const fetchSchoolData = async () => {
  try {
    if (API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      console.warn('API URL is not set. Using mock data.');
      return null;
    }
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching school data:', error);
    return null;
  }
};

export const submitPPDBForm = async (formData) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'PPDB',
        ...formData
      }),
    });
    return { success: true };
  } catch (error) {
    console.error('Error submitting form:', error);
    return { success: false, error };
  }
};

export const saveQuestions = async (payload) => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "no-cors", // Keeping no-cors for simple Google Script compatibility
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving to GSheet:", error);
    return { success: false, error };
  }
};
