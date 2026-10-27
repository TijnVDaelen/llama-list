export function taskTitle(value) {
  const title = value.trim();
  if (!title) throw new Error('Enter a task name.');
  if (title.length > 300) throw new Error('Use 300 characters or fewer.');
  return title;
}

export function taskOrder(tasks) {
  return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
