export interface ChatScenario {
  id: string
  title: string
  /** What the learner has to achieve (shown above the chat). */
  description: string
  /** Who the AI plays. */
  aiRole: string
  register: 'formal' | 'informal'
  /** 2–3 concrete things to do in the conversation. */
  goals: string[]
  /** The AI's first message; empty when the learner writes first. */
  opening: string
}

/** Ready-made situations for written correspondence (emails and chats) at B1–B2. */
export const CHAT_SCENARIOS: ChatScenario[] = [
  {
    id: 'landlord-heating',
    title: 'Broken heating — message to your landlord',
    description: 'The heating in your flat has stopped working. Write to your landlord.',
    aiRole: 'a landlord called Mr Harris, polite but busy',
    register: 'formal',
    goals: ['explain the problem', 'say how long it has been broken', 'agree on when someone can come'],
    opening: ''
  },
  {
    id: 'colleague-meeting',
    title: 'Reschedule a meeting with a colleague',
    description: 'You cannot come to tomorrow\'s meeting. Write to your colleague Sam in the work chat.',
    aiRole: 'a friendly colleague called Sam',
    register: 'informal',
    goals: ['say you cannot come and why', 'suggest a new time', 'ask what you will miss'],
    opening: 'Hi! Are we still on for the meeting tomorrow at 10?'
  },
  {
    id: 'job-interview',
    title: 'Job interview',
    description: 'You are at an interview for a job you want. Answer the interviewer\'s questions.',
    aiRole: 'an interviewer called Ms Clark at a friendly international company',
    register: 'formal',
    goals: ['introduce yourself', 'describe your experience', 'ask one question about the job'],
    opening: 'Good morning, and thank you for coming. Please, tell me a little about yourself.'
  },
  {
    id: 'restaurant-complaint',
    title: 'Complain to a restaurant manager',
    description: 'Your food was cold and the waiter was rude. Write to the manager.',
    aiRole: 'a restaurant manager called Ms Evans who wants to solve the problem',
    register: 'formal',
    goals: ['describe what went wrong', 'say how you felt', 'say what you expect them to do'],
    opening: ''
  },
  {
    id: 'hotel-room',
    title: 'Ask a hotel to change your room',
    description: 'Your hotel room is noisy and the window does not close. Write to the reception.',
    aiRole: 'a hotel receptionist called Anna',
    register: 'formal',
    goals: ['explain the problems', 'ask for a different room', 'ask about the breakfast time'],
    opening: 'Good evening, reception speaking. How can I help you?'
  },
  {
    id: 'weekend-plans',
    title: 'Plan a weekend with a friend',
    description: 'You and your friend Alex want to do something fun this weekend. Decide what to do.',
    aiRole: 'a friend called Alex who likes music and hiking',
    register: 'informal',
    goals: ['suggest an activity', 'discuss time and place', 'agree on a plan'],
    opening: 'Hey! Any ideas for the weekend? I\'m so bored.'
  },
  {
    id: 'doctor-appointment',
    title: 'Book a doctor\'s appointment',
    description: 'You do not feel well and want to see a doctor soon. Write to the clinic.',
    aiRole: 'a clinic receptionist called Mark',
    register: 'formal',
    goals: ['describe your symptoms', 'ask for an appointment', 'ask what to bring'],
    opening: 'Good morning, City Clinic. How can I help?'
  },
  {
    id: 'film-chat',
    title: 'Talk about a film',
    description: 'You have just seen a film. Chat with a friend about it.',
    aiRole: 'a friend called Kate who has also seen it',
    register: 'informal',
    goals: ['say what you thought of it', 'compare it with another film', 'recommend something to watch next'],
    opening: 'So, did you watch it last night? What did you think?'
  },
  {
    id: 'return-product',
    title: 'Return a product',
    description: 'You bought headphones that stopped working after a week. Contact customer support.',
    aiRole: 'a customer support agent called Daniel',
    register: 'formal',
    goals: ['explain what is wrong', 'say when and where you bought it', 'ask for a refund or a replacement'],
    opening: 'Hello, you are in touch with customer support. How can I help you today?'
  },
  {
    id: 'new-colleague',
    title: 'Welcome a new colleague',
    description: 'A new person has joined your team. Chat and help them settle in.',
    aiRole: 'a new colleague called Jordan on their first day',
    register: 'informal',
    goals: ['introduce yourself and your work', 'recommend a place for lunch', 'offer help with something'],
    opening: 'Hi, I\'m Jordan, I\'ve just started today. I don\'t really know where anything is!'
  }
]
