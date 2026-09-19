const DAY_MS = 86400000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeTopicMastery(rows, now = Date.now()) {
  const groups = new Map();

  for (const row of rows || []) {
    const score = Number(row.score);
    const total = Number(row.total);
    const timestamp = new Date(row.created_at).getTime();
    const topic = String(row.topic || '').trim();
    if (!topic || !Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || !Number.isFinite(timestamp)) continue;

    const key = topic.toLocaleLowerCase('fr');
    if (!groups.has(key)) groups.set(key, { topic, attempts: [] });
    groups.get(key).attempts.push({
      pct: clamp(score / total * 100, 0, 100),
      timestamp,
    });
  }

  return [...groups.values()].map(group => {
    const attempts = group.attempts.sort((a, b) => b.timestamp - a.timestamp);
    let weightedTotal = 0;
    let weights = 0;

    for (const attempt of attempts) {
      const ageDays = Math.max(0, (now - attempt.timestamp) / DAY_MS);
      const weight = Math.max(0.2, Math.exp(-ageDays / 30));
      weightedTotal += attempt.pct * weight;
      weights += weight;
    }

    const average = weights ? weightedTotal / weights : 0;
    const latest = attempts[0];
    const daysSinceReview = Math.max(0, Math.floor((now - latest.timestamp) / DAY_MS));
    const confidenceBonus = Math.min(10, attempts.length / 3 * 10);
    const forgettingPenalty = Math.min(20, Math.max(0, daysSinceReview - 7) * 0.7);
    const mastery = clamp(Math.round(average * 0.7 + latest.pct * 0.2 + confidenceBonus - forgettingPenalty), 0, 100);

    return {
      topic: group.topic,
      mastery,
      attempts: attempts.length,
      latestPct: Math.round(latest.pct),
      daysSinceReview,
      status: mastery < 50 ? 'review' : mastery < 75 ? 'consolidate' : 'mastered',
    };
  }).sort((a, b) => a.mastery - b.mastery || b.daysSinceReview - a.daysSinceReview);
}

function daysUntil(dateValue, now = Date.now()) {
  if (!dateValue) return null;
  const target = new Date(`${dateValue}T00:00:00`).getTime();
  if (!Number.isFinite(target)) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target - today.getTime()) / DAY_MS));
}

function buildDailyPlan({ mastery = [], dueCards = 0, examDate = null, now = Date.now() } = {}) {
  const examDays = daysUntil(examDate, now);
  const targetMinutes = examDays !== null && examDays <= 3 ? 45 : examDays !== null && examDays <= 7 ? 40 : 30;
  const tasks = [];

  if (dueCards > 0) {
    tasks.push({
      type: 'srs',
      title: `Réviser ${dueCards} carte${dueCards > 1 ? 's' : ''}`,
      reason: 'Révisions arrivées à échéance',
      minutes: Math.min(15, Math.max(5, Math.ceil(dueCards / 5) * 5)),
    });
  }

  const weakTopics = mastery.filter(item => item.mastery < 75).slice(0, 3);
  for (const item of weakTopics) {
    if (tasks.reduce((sum, task) => sum + task.minutes, 0) >= targetMinutes) break;
    const remaining = targetMinutes - tasks.reduce((sum, task) => sum + task.minutes, 0);
    const minutes = Math.min(item.mastery < 50 ? 15 : 10, remaining);
    if (minutes < 5) break;
    tasks.push({
      type: 'quiz',
      topic: item.topic,
      title: item.mastery < 50 ? `Retravailler ${item.topic}` : `Consolider ${item.topic}`,
      reason: `Maîtrise estimée à ${item.mastery} %`,
      minutes,
    });
  }

  if (!tasks.length && mastery.length) {
    const oldest = [...mastery].sort((a, b) => b.daysSinceReview - a.daysSinceReview)[0];
    tasks.push({
      type: 'quiz',
      topic: oldest.topic,
      title: `Entretenir ${oldest.topic}`,
      reason: 'Vérification régulière des acquis',
      minutes: 10,
    });
  }

  const plannedMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  return { examDays, targetMinutes, plannedMinutes, tasks };
}

module.exports = { computeTopicMastery, buildDailyPlan, daysUntil };
