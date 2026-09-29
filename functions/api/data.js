// GET /api/data — pengganti Apps Script doGet(). Balasan dibuat SAMA BENTUK dengan
// fetchSchoolData() yang lama supaya frontend (src/services/gsheet.js dst) tidak
// perlu ditulis ulang saat cutover nanti.
import { TABLES, READONLY_TABLES, GRADES, rowToJson } from '../_lib/tables.js';
import { json } from '../_lib/auth.js';

const selectAll = async (env, cfg) => {
  const orderBy = cfg.orderCol === 'rowid' ? 'rowid' : cfg.orderCol;
  const { results } = await env.DB.prepare(`SELECT * FROM ${cfg.table} ORDER BY ${orderBy}`).all();
  return results.map((r) => rowToJson(cfg, r));
};

// Bentuk ulang QuestionFolders + Questions -> TeacherQuestions (persis buildTeacherQuestions di Code.gs lama).
const buildTeacherQuestions = async (env) => {
  const folders = await selectAll(env, TABLES.QuestionFolders);
  const questions = await selectAll(env, TABLES.Questions);
  const byFolder = {};
  questions.forEach((q) => {
    const fid = String(q.folderId);
    (byFolder[fid] ||= []).push({
      id: String(q.id), text: q.text,
      options: { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD },
      correctAnswer: q.correctAnswer, type: q.type || 'pg', updatedAt: q.updatedAt, order: q.order,
    });
  });
  const orderNum = (v) => (v === '' || v == null || isNaN(Number(v)) ? Infinity : Number(v));
  Object.values(byFolder).forEach((arr) => arr.sort((a, b) => orderNum(a.order) - orderNum(b.order)));

  return GRADES.map((grade) => {
    const gradeFolders = folders.filter((f) => String(f.grade) === grade).map((f) => ({ id: String(f.id), name: f.name }));
    const questionsObj = {};
    gradeFolders.forEach((f) => { questionsObj[f.id] = byFolder[f.id] || []; });
    return { grade, data: { updatedAt: Date.now(), examTypes: { [grade]: gradeFolders }, questions: questionsObj } };
  });
};

export async function onRequestGet({ env }) {
  const result = {};
  for (const name of Object.keys(TABLES)) {
    if (name === 'QuestionFolders' || name === 'Questions') continue; // diekspos lewat TeacherQuestions, bukan mentah
    result[name] = await selectAll(env, TABLES[name]);
  }
  for (const name of Object.keys(READONLY_TABLES)) {
    result[name] = await selectAll(env, READONLY_TABLES[name]);
  }
  result.TeacherQuestions = await buildTeacherQuestions(env);
  return json(result);
}
