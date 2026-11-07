export type TaskKind = 'email' | 'opinion' | 'description' | 'story' | 'review'

export interface WritingTask {
  id: string
  kind: TaskKind
  title: string
  /** What the learner has to do (Markdown). */
  prompt: string
  minWords: number
  maxWords: number
}

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  email: 'Email / letter',
  opinion: 'Opinion',
  description: 'Description',
  story: 'Story',
  review: 'Review'
}

const t = (id: string, kind: TaskKind, title: string, prompt: string, minWords = 120, maxWords = 200): WritingTask => ({ id, kind, title, prompt, minWords, maxWords })

/** Monthly writing tasks at B1–B2: each has a clear purpose, a reader and 3–4 things to cover. */
export const WRITING_TASKS: WritingTask[] = [
  t('email-friend-visit', 'email', 'Invite a friend to visit', 'Your friend from abroad is coming to your city for a weekend. Write an **email** to them.\n\n- say you are happy about the visit\n- suggest two or three things to do\n- tell them what to pack and why\n- ask about their travel plans'),
  t('email-complaint-hotel', 'email', 'Complain to a hotel', 'You stayed in a hotel last week and the stay was disappointing. Write a **formal email** to the manager.\n\n- explain when and where you stayed\n- describe two or three problems\n- say how you felt about them\n- say what you want the hotel to do'),
  t('email-job', 'email', 'Apply for a job', 'You saw an advertisement for a part-time job that interests you. Write a **formal email** to the manager.\n\n- say which job you are applying for and where you saw it\n- describe your experience and skills\n- explain why you want this job\n- ask about the next steps'),
  t('email-neighbour', 'email', 'Talk to a noisy neighbour', 'Your neighbour often makes a lot of noise in the evening. Write a **polite message** to them.\n\n- explain the problem calmly\n- say how it affects you\n- suggest a solution\n- thank them in advance'),
  t('email-refund', 'email', 'Ask for a refund', 'You bought something online, but it arrived broken. Write an **email** to customer support.\n\n- say what you ordered and when\n- explain what is wrong\n- say what you want (a refund or a replacement)\n- ask how long it will take'),
  t('opinion-remote-work', 'opinion', 'Working from home', 'Some people say working from home is better than working in an office. Write an **essay** giving your opinion.\n\n- give at least two reasons for your opinion\n- mention one argument for the other side\n- finish with a clear conclusion'),
  t('opinion-social-media', 'opinion', 'Social media and young people', 'Do social networks do more good or harm to young people? Write an **opinion essay**.\n\n- say what you think and why\n- give an example from your own experience or from people you know\n- suggest one rule that could help'),
  t('opinion-city-village', 'opinion', 'City or village', 'Is it better to live in a big city or in a village? Write an **essay**.\n\n- compare two or three advantages and disadvantages\n- say where you would prefer to live\n- explain your choice'),
  t('opinion-learning-languages', 'opinion', 'Learning languages', 'Why is it useful to learn foreign languages? Write an **essay**.\n\n- give two or three benefits\n- say what makes learning a language difficult\n- give one piece of advice to a beginner'),
  t('opinion-money-happiness', 'opinion', 'Money and happiness', 'Can money buy happiness? Write an **essay** with your opinion.\n\n- explain what money can and cannot give a person\n- give an example\n- finish with your conclusion'),
  t('desc-favourite-place', 'description', 'Your favourite place', 'Describe a place where you like to spend time.\n\n- say where it is and what it looks like\n- describe the atmosphere and what people do there\n- explain why it is special for you'),
  t('desc-person', 'description', 'A person who inspires you', 'Write about a person you admire (a family member, a teacher, a public figure).\n\n- say who they are and how you know them\n- describe their personality\n- explain what you learned from them'),
  t('desc-typical-day', 'description', 'A typical day', 'Describe a typical day in your life and say what you would change in it.\n\n- describe the morning, the day and the evening\n- say which part you enjoy most\n- say what you would like to change and why'),
  t('desc-dream-home', 'description', 'Your dream home', 'Describe the home you would like to have in the future.\n\n- where it is and what it looks like\n- the rooms and things you would put in them\n- why this home would make you happy'),
  t('desc-tradition', 'description', 'A tradition in your country', 'Write about a holiday or tradition that is important in Ukraine.\n\n- when and how people celebrate it\n- what people eat, wear or do\n- what it means to you'),
  t('story-unexpected', 'story', 'An unexpected meeting', 'Write a **story** that begins with the sentence: *"I could not believe who was standing at the door."*\n\n- use past tenses (past simple, past continuous, past perfect)\n- include dialogue or direct speech\n- give the story a clear ending'),
  t('story-lost', 'story', 'A day when everything went wrong', 'Write about a day when everything went wrong.\n\n- say what happened first and how it got worse\n- describe how you felt\n- explain how the day ended and what you learned'),
  t('story-journey', 'story', 'A memorable journey', 'Write about a journey you remember well.\n\n- where you went and who you went with\n- one problem or surprise on the way\n- why you still remember it'),
  t('story-first-time', 'story', 'The first time', 'Write about the first time you did something important (the first day at work or school, a first trip, a first performance).\n\n- what you expected\n- what really happened\n- how you felt afterwards'),
  t('review-film', 'review', 'Review a film or series', 'Write a **review** of a film or a series you have watched recently.\n\n- say what it is about (without telling the end)\n- say what you liked and what you did not like\n- say who you would recommend it to'),
  t('review-book', 'review', 'Review a book', 'Write a **review** of a book you have read.\n\n- say what kind of book it is and what it is about\n- describe the characters or the main idea\n- give your opinion and a recommendation'),
  t('review-restaurant', 'review', 'Review a restaurant', 'Write a **review** of a café or restaurant for a website.\n\n- describe the place, the food and the service\n- say what was good and what could be better\n- say if you would go there again'),
  t('review-app', 'review', 'Review an app', 'Write a **review** of an app or a website you use often.\n\n- say what it is for and how you use it\n- describe two good things and one problem\n- say who should use it'),
  t('opinion-ai', 'opinion', 'Artificial intelligence', 'Will artificial intelligence make our lives easier or more difficult? Write an **essay**.\n\n- give two or three examples from everyday life\n- mention a possible danger\n- say what you think will happen in ten years')
]

/** 'YYYY-MM' of a date, in local time. */
export function monthKey(d: Date | string = new Date()): string {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
}

/** The task suggested for a month: the bank rotates month by month, `offset` picks the next ones ("Another task"). */
export function taskForMonth(month: string, offset = 0): WritingTask {
  const [y, m] = month.split('-').map(Number)
  const idx = (y * 12 + (m - 1) + offset) % WRITING_TASKS.length
  return WRITING_TASKS[((idx % WRITING_TASKS.length) + WRITING_TASKS.length) % WRITING_TASKS.length]
}
