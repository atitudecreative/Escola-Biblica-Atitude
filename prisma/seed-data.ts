/**
 * Conteúdo demonstrativo da Escola Bíblica Atitude.
 * Tudo aqui é fictício e serve apenas para demonstrar a plataforma.
 */

export const CATEGORIES = [
  { name: "Bíblia", slug: "biblia", icon: "book-open", description: "Panoramas, livros e contexto das Escrituras." },
  { name: "Teologia", slug: "teologia", icon: "landmark", description: "Doutrina, hermenêutica e história do pensamento cristão." },
  { name: "Liderança", slug: "lideranca", icon: "compass", description: "Liderar pessoas e ministérios com caráter e visão." },
  { name: "Família", slug: "familia", icon: "heart-handshake", description: "Casamento, criação de filhos e relacionamentos." },
  { name: "Discipulado", slug: "discipulado", icon: "sprout", description: "Crescimento espiritual e formação de discípulos." },
  { name: "Comunicação", slug: "comunicacao", icon: "mic", description: "Oratória, ensino e comunicação no ministério." },
  { name: "Missões", slug: "missoes", icon: "globe", description: "Evangelismo, missões urbanas e transculturais." },
  { name: "Vida cristã", slug: "vida-crista", icon: "sun", description: "Disciplinas espirituais e fé no cotidiano." },
];

export type LessonSeed = {
  title: string;
  type: "VIDEO" | "TEXT" | "PDF" | "QUIZ" | "ASSIGNMENT" | "LINK" | "AUDIO";
  minutes?: number;
  preview?: boolean;
};

export type CourseSeed = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  teacher: number; // índice em TEACHERS
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  status: "DRAFT" | "REVIEW" | "PUBLISHED";
  workloadHours: number;
  featured?: boolean;
  sequential?: boolean;
  tags: string[];
  description: string;
  objectives: string[];
  requirements: string[];
  audience: string[];
  modules: { title: string; lessons: LessonSeed[] }[];
};

export const TEACHERS = [
  { name: "Pr. André Carvalho", email: "professor@demo.eba", headline: "Pastor de ensino · Mestre em Teologia Bíblica", bio: "Há 15 anos ensina Bíblia para adultos. Apaixonado por mostrar como a grande história das Escrituras se conecta com a vida real." },
  { name: "Dra. Helena Duarte", email: "helena.duarte@demo.eba", headline: "Doutora em Teologia Sistemática", bio: "Professora de teologia e hermenêutica. Acredita que boa doutrina produz vida devocional profunda e prática." },
  { name: "Samuel Ribeiro", email: "samuel.ribeiro@demo.eba", headline: "Líder de ministérios · Consultor em liderança", bio: "Coordena equipes de voluntários há mais de uma década e ajuda líderes a servirem com clareza e cuidado." },
];

export const MANAGERS = [
  { name: "Juliana Prado", email: "gestor@demo.eba", headline: "Coordenadora pedagógica" },
  { name: "Marcos Albuquerque", email: "marcos.albuquerque@demo.eba", headline: "Secretaria acadêmica" },
];

export const ADMIN = { name: "Rafael Monteiro", email: "admin@demo.eba", headline: "Coordenação da Escola" };

export const STUDENTS = [
  { name: "Ana Beatriz Lima", email: "aluno@demo.eba", headline: "Líder de pequeno grupo" },
  { name: "Lucas Ferreira", email: "lucas.ferreira@demo.eba", headline: "Ministério de jovens" },
  { name: "Mariana Costa", email: "mariana.costa@demo.eba", headline: "Professora infantil" },
  { name: "Pedro Henrique Souza", email: "pedro.souza@demo.eba", headline: "Diácono" },
  { name: "Camila Rocha", email: "camila.rocha@demo.eba", headline: "Ministério de louvor" },
  { name: "Gabriel Martins", email: "gabriel.martins@demo.eba", headline: "Membro" },
  { name: "Larissa Almeida", email: "larissa.almeida@demo.eba", headline: "Ministério de casais" },
  { name: "Thiago Nunes", email: "thiago.nunes@demo.eba", headline: "Líder de célula" },
  { name: "Beatriz Oliveira", email: "beatriz.oliveira@demo.eba", headline: "Membro" },
  { name: "Daniel Santos", email: "daniel.santos@demo.eba", headline: "Ministério de acolhimento" },
];

export const FIRST_NAMES = ["João", "Maria", "José", "Fernanda", "Rafaela", "Bruno", "Aline", "Felipe", "Patrícia", "Rodrigo", "Juliana", "Eduardo", "Letícia", "Vinícius", "Renata", "Gustavo", "Priscila", "Leonardo", "Tatiane", "Mateus", "Carolina", "Diego", "Isabela", "Henrique", "Natália", "André", "Vanessa", "Caio", "Sabrina", "Otávio"];
export const LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Pereira", "Lima", "Carvalho", "Ribeiro", "Almeida", "Gomes", "Martins", "Araújo", "Barbosa", "Cardoso", "Teixeira", "Moreira", "Mendes", "Freitas", "Rocha", "Dias"];

const std = (title: string): LessonSeed[] => [
  { title: `Visão geral: ${title}`, type: "VIDEO", minutes: 3, preview: true },
  { title: "Leitura guiada", type: "TEXT", minutes: 12 },
  { title: "Material de apoio", type: "PDF", minutes: 15 },
];

export const COURSES: CourseSeed[] = [
  {
    slug: "panorama-do-antigo-testamento",
    title: "Panorama do Antigo Testamento",
    subtitle: "A grande história de Deus da criação aos profetas",
    category: "biblia",
    teacher: 0,
    level: "BEGINNER",
    status: "PUBLISHED",
    workloadHours: 12,
    featured: true,
    sequential: true,
    tags: ["antigo testamento", "panorama", "história bíblica"],
    description:
      "Uma jornada pelos 39 livros do Antigo Testamento para entender a narrativa que prepara a vinda de Cristo.\n\nVocê vai conhecer a estrutura dos livros, os grandes personagens, as alianças e os temas que atravessam toda a Escritura — sempre com foco em como ler e aplicar o texto hoje.",
    objectives: ["Compreender a estrutura e os gêneros do Antigo Testamento", "Situar os principais personagens e eventos numa linha do tempo", "Reconhecer as alianças como fio condutor da narrativa", "Ler os profetas com contexto histórico"],
    requirements: ["Nenhum conhecimento prévio", "Uma Bíblia (qualquer tradução)"],
    audience: ["Novos convertidos", "Membros que desejam uma visão geral da Bíblia", "Líderes de pequenos grupos"],
    modules: [
      { title: "Pentateuco: o fundamento", lessons: [{ title: "Por que estudar o Antigo Testamento?", type: "VIDEO", minutes: 3, preview: true }, { title: "Gênesis: origens e promessas", type: "TEXT", minutes: 14 }, { title: "Êxodo e a formação de um povo", type: "VIDEO", minutes: 3 }, { title: "Guia de leitura do Pentateuco", type: "PDF", minutes: 15 }] },
      { title: "Livros históricos", lessons: [{ title: "Josué e Juízes: conquista e ciclos", type: "VIDEO", minutes: 3 }, { title: "O reino unido: Saul, Davi e Salomão", type: "TEXT", minutes: 12 }, { title: "Divisão e exílio", type: "TEXT", minutes: 10 }] },
      { title: "Poesia e sabedoria", lessons: [{ title: "Salmos: a oração do povo de Deus", type: "VIDEO", minutes: 3 }, { title: "Provérbios, Eclesiastes e Jó", type: "TEXT", minutes: 12 }, { title: "Atividade: um salmo na sua semana", type: "ASSIGNMENT", minutes: 30 }] },
      { title: "Profetas e avaliação", lessons: [{ title: "Profetas maiores e menores", type: "TEXT", minutes: 14 }, { title: "Avaliação final do módulo", type: "QUIZ", minutes: 15 }] },
    ],
  },
  {
    slug: "panorama-do-novo-testamento",
    title: "Panorama do Novo Testamento",
    subtitle: "Evangelhos, igreja primitiva e a esperança cristã",
    category: "biblia",
    teacher: 0,
    level: "BEGINNER",
    status: "PUBLISHED",
    workloadHours: 12,
    featured: true,
    tags: ["novo testamento", "evangelhos", "panorama"],
    description: "Conheça os 27 livros do Novo Testamento, seu contexto histórico e a mensagem central do evangelho de Jesus Cristo.",
    objectives: ["Diferenciar os quatro evangelhos e suas ênfases", "Acompanhar a expansão da igreja em Atos", "Entender a estrutura das cartas paulinas", "Ler Apocalipse com esperança e responsabilidade"],
    requirements: ["Recomendado: Panorama do Antigo Testamento"],
    audience: ["Todos os membros", "Professores de escola bíblica"],
    modules: [
      { title: "Os evangelhos", lessons: [{ title: "O mundo do primeiro século", type: "VIDEO", minutes: 3, preview: true }, { title: "Mateus, Marcos, Lucas e João", type: "TEXT", minutes: 15 }, { title: "Mapa dos evangelhos", type: "PDF", minutes: 10 }] },
      { title: "Atos e as cartas", lessons: [{ title: "Atos: o evangelho em movimento", type: "VIDEO", minutes: 3 }, { title: "As cartas de Paulo", type: "TEXT", minutes: 14 }, { title: "Cartas gerais", type: "TEXT", minutes: 10 }] },
      { title: "Esperança e avaliação", lessons: [{ title: "Apocalipse sem medo", type: "VIDEO", minutes: 3 }, { title: "Questionário final", type: "QUIZ", minutes: 15 }] },
    ],
  },
  {
    slug: "hermeneutica-como-interpretar-a-biblia",
    title: "Hermenêutica: como interpretar a Bíblia",
    subtitle: "Ferramentas para ler o texto com fidelidade e profundidade",
    category: "teologia",
    teacher: 1,
    level: "INTERMEDIATE",
    status: "PUBLISHED",
    workloadHours: 16,
    featured: true,
    sequential: true,
    tags: ["hermenêutica", "interpretação", "estudo bíblico"],
    description: "Aprenda princípios sólidos de interpretação: contexto, gênero literário, gramática, história e aplicação. Um curso prático, com exercícios de interpretação em textos reais.",
    objectives: ["Aplicar o método observação–interpretação–aplicação", "Identificar gêneros literários e suas regras de leitura", "Evitar erros comuns de interpretação", "Preparar um estudo bíblico fiel ao texto"],
    requirements: ["Panorama bíblico (AT ou NT)", "Disposição para exercícios semanais"],
    audience: ["Líderes e professores", "Quem prepara estudos e pregações"],
    modules: [
      { title: "Fundamentos", lessons: [{ title: "O que é hermenêutica", type: "VIDEO", minutes: 3, preview: true }, { title: "Os três horizontes do texto", type: "TEXT", minutes: 14 }, { title: "Checklist de interpretação", type: "PDF", minutes: 10 }] },
      { title: "Contexto e gênero", lessons: [{ title: "Contexto histórico e literário", type: "VIDEO", minutes: 3 }, { title: "Narrativa, poesia, profecia e epístola", type: "TEXT", minutes: 16 }, { title: "Exercício de interpretação", type: "ASSIGNMENT", minutes: 45 }] },
      { title: "Da interpretação à aplicação", lessons: [{ title: "Princípios de aplicação", type: "VIDEO", minutes: 3 }, { title: "Erros comuns", type: "TEXT", minutes: 12 }, { title: "Avaliação final", type: "QUIZ", minutes: 20 }] },
    ],
  },
  {
    slug: "fundamentos-da-fe-crista",
    title: "Fundamentos da Fé Cristã",
    subtitle: "As doutrinas essenciais explicadas com clareza",
    category: "teologia",
    teacher: 1,
    level: "BEGINNER",
    status: "PUBLISHED",
    workloadHours: 10,
    tags: ["doutrina", "fundamentos", "novos membros"],
    description: "Deus, Escrituras, salvação, igreja e esperança: um percurso pelas doutrinas centrais do cristianismo, pensado para quem está começando e para quem quer revisar as bases.",
    objectives: ["Explicar as doutrinas centrais da fé", "Relacionar doutrina e vida devocional", "Responder dúvidas comuns com base bíblica"],
    requirements: ["Nenhum"],
    audience: ["Novos membros", "Classes de batismo"],
    modules: [
      { title: "Deus e sua Palavra", lessons: std("Deus e as Escrituras") },
      { title: "Salvação e vida nova", lessons: [...std("salvação pela graça"), { title: "Reflexão escrita: minha história com Deus", type: "ASSIGNMENT", minutes: 30 }] },
      { title: "Igreja e esperança", lessons: [...std("a igreja"), { title: "Questionário", type: "QUIZ", minutes: 15 }] },
    ],
  },
  {
    slug: "lideranca-servidora",
    title: "Liderança Servidora",
    subtitle: "Liderar como Jesus: caráter, visão e cuidado com pessoas",
    category: "lideranca",
    teacher: 2,
    level: "INTERMEDIATE",
    status: "PUBLISHED",
    workloadHours: 8,
    featured: true,
    tags: ["liderança", "equipes", "ministério"],
    description: "Um curso prático para líderes de ministérios, células e equipes de voluntários. Caráter do líder, formação de equipes, comunicação e resolução de conflitos.",
    objectives: ["Desenvolver o caráter do líder servidor", "Montar e cuidar de equipes de voluntários", "Conduzir reuniões e conversas difíceis", "Planejar o ministério com propósito"],
    requirements: ["Estar servindo ou se preparando para servir em algum ministério"],
    audience: ["Líderes de ministério", "Líderes de célula", "Coordenadores de voluntários"],
    modules: [
      { title: "O coração do líder", lessons: [{ title: "Liderança no Reino", type: "VIDEO", minutes: 3, preview: true }, { title: "Caráter antes de carisma", type: "TEXT", minutes: 12 }, { title: "Autoavaliação do líder", type: "PDF", minutes: 20 }] },
      { title: "Pessoas e equipes", lessons: [{ title: "Recrutar, formar e enviar", type: "VIDEO", minutes: 3 }, { title: "Conflitos e conversas difíceis", type: "TEXT", minutes: 14 }, { title: "Plano de cuidado da equipe", type: "ASSIGNMENT", minutes: 40 }, { title: "Checagem de aprendizagem", type: "QUIZ", minutes: 10 }] },
    ],
  },
  {
    slug: "familia-e-casamento",
    title: "Família e Casamento à luz da Bíblia",
    subtitle: "Aliança, comunicação e criação de filhos",
    category: "familia",
    teacher: 2,
    level: "BEGINNER",
    status: "PUBLISHED",
    workloadHours: 6,
    tags: ["família", "casamento", "filhos"],
    description: "Princípios bíblicos e ferramentas práticas para fortalecer o casamento e a família: aliança, comunicação, finanças e educação dos filhos.",
    objectives: ["Compreender o casamento como aliança", "Praticar comunicação saudável", "Educar filhos com graça e verdade"],
    requirements: ["Nenhum — casados, noivos e solteiros são bem-vindos"],
    audience: ["Casais", "Noivos", "Pais e mães"],
    modules: [
      { title: "Aliança", lessons: std("o casamento como aliança") },
      { title: "Comunicação e filhos", lessons: [...std("a comunicação no lar"), { title: "Questionário", type: "QUIZ", minutes: 10 }] },
    ],
  },
  {
    slug: "discipulado-na-pratica",
    title: "Discipulado na Prática",
    subtitle: "Como acompanhar pessoas no caminho de Jesus",
    category: "discipulado",
    teacher: 0,
    level: "BEGINNER",
    status: "PUBLISHED",
    workloadHours: 8,
    tags: ["discipulado", "mentoria", "pequenos grupos"],
    description: "Do chamado à prática: um roteiro simples para discipular uma pessoa ao longo de um ano, com encontros, leituras e ferramentas.",
    objectives: ["Entender o discipulado como estilo de vida", "Conduzir encontros de discipulado", "Usar um roteiro de 12 encontros"],
    requirements: ["Nenhum"],
    audience: ["Membros que desejam discipular alguém", "Líderes de pequenos grupos"],
    modules: [
      { title: "O chamado", lessons: std("o chamado ao discipulado") },
      { title: "O encontro", lessons: [...std("o encontro de discipulado"), { title: "Relato de um encontro", type: "ASSIGNMENT", minutes: 30 }, { title: "Questionário", type: "QUIZ", minutes: 10 }] },
    ],
  },
  {
    slug: "missoes-urbanas",
    title: "Missões Urbanas",
    subtitle: "O evangelho nas cidades: presença, serviço e proclamação",
    category: "missoes",
    teacher: 0,
    level: "INTERMEDIATE",
    status: "REVIEW",
    workloadHours: 8,
    tags: ["missões", "evangelismo", "cidade"],
    description: "Como a igreja pode ser sinal do Reino nas cidades: diagnóstico do bairro, projetos de serviço e evangelismo relacional.",
    objectives: ["Mapear necessidades do bairro", "Planejar um projeto de serviço", "Praticar evangelismo relacional"],
    requirements: ["Nenhum"],
    audience: ["Ministérios de ação social", "Equipes de evangelismo"],
    modules: [{ title: "A cidade e o Reino", lessons: std("missão urbana") }],
  },
  {
    slug: "comunicacao-e-oratoria-para-o-ministerio",
    title: "Comunicação e Oratória para o Ministério",
    subtitle: "Ensinar e pregar com clareza",
    category: "comunicacao",
    teacher: 2,
    level: "INTERMEDIATE",
    status: "DRAFT",
    workloadHours: 10,
    tags: ["oratória", "pregação", "ensino"],
    description: "Estrutura de mensagens, uso da voz, ilustrações e presença no púlpito e em sala de aula.",
    objectives: ["Estruturar uma mensagem", "Usar a voz e o corpo com naturalidade"],
    requirements: ["Nenhum"],
    audience: ["Professores e pregadores"],
    modules: [{ title: "Estrutura da mensagem", lessons: [{ title: "Ideia central", type: "VIDEO", minutes: 3 }, { title: "Esboço", type: "TEXT", minutes: 10 }] }],
  },
];

export function textLesson(title: string, course: string) {
  return `## ${title}

Nesta aula de **${course}**, vamos olhar com calma para o tema e entender por que ele importa para a nossa caminhada.

> “Toda a Escritura é inspirada por Deus e útil para o ensino, para a repreensão, para a correção e para a instrução na justiça.” — 2 Timóteo 3:16

### Para começar

Antes de avançar, leia o texto bíblico indicado pelo professor e anote três observações: **o que o texto diz**, **o que ele significava para os primeiros leitores** e **o que ele comunica hoje**.

### Pontos principais

1. **Contexto** — quem escreveu, para quem e em que situação.
2. **Mensagem** — qual é a ideia central que o autor quer transmitir.
3. **Conexão** — como o tema se liga à grande história da Bíblia, que culmina em Cristo.
4. **Aplicação** — que mudança concreta o texto propõe para a sua vida e para a comunidade.

### Para refletir

- O que mais chamou sua atenção nesta leitura?
- Existe alguma área da sua vida que este tema confronta ou consola?
- Com quem você pode compartilhar o que aprendeu esta semana?

---

*Dica:* use a aba **Comentários** abaixo para compartilhar suas anotações com a turma, ou envie uma dúvida ao professor pela aba **Dúvidas**.`;
}

export const QUIZ_BANK = [
  {
    type: "SINGLE_CHOICE" as const,
    prompt: "Qual é o primeiro passo recomendado ao estudar um texto bíblico?",
    options: [
      { text: "Observar atentamente o que o texto diz", correct: true },
      { text: "Buscar imediatamente uma aplicação pessoal", correct: false },
      { text: "Consultar apenas comentários", correct: false },
      { text: "Ler somente versículos isolados", correct: false },
    ],
    explanation: "A observação vem antes da interpretação e da aplicação.",
  },
  {
    type: "TRUE_FALSE" as const,
    prompt: "O contexto histórico ajuda a entender o sentido original de um texto.",
    options: [
      { text: "Verdadeiro", correct: true },
      { text: "Falso", correct: false },
    ],
    explanation: "Conhecer autor, destinatários e situação evita leituras anacrônicas.",
  },
  {
    type: "MULTIPLE_CHOICE" as const,
    prompt: "Quais elementos fazem parte do contexto de uma passagem? (marque todas que se aplicam)",
    options: [
      { text: "Os versículos anteriores e posteriores", correct: true },
      { text: "O gênero literário do livro", correct: true },
      { text: "A situação dos primeiros leitores", correct: true },
      { text: "A opinião pessoal do leitor atual", correct: false },
    ],
    explanation: "Contexto literário, gênero e contexto histórico são essenciais.",
  },
  {
    type: "SHORT_ANSWER" as const,
    prompt: "Em uma palavra: como se chama o pacto que Deus estabelece com seu povo ao longo da Bíblia?",
    accepted: ["aliança", "alianca", "pacto"],
    explanation: "As alianças são um fio condutor de toda a Escritura.",
  },
  {
    type: "ESSAY" as const,
    prompt: "Descreva, em poucas linhas, como o conteúdo deste curso pode influenciar sua vida comunitária.",
    explanation: "Resposta aberta, corrigida pelo professor.",
  },
];

export const TESTIMONIALS = [
  { name: "Carla Mendes", role: "Líder de pequeno grupo", quote: "O curso de Hermenêutica mudou a forma como eu preparo os estudos da minha célula. Hoje sigo um método e o grupo percebeu a diferença." },
  { name: "Roberto Farias", role: "Diácono", quote: "Consegui estudar no meu ritmo, no celular, entre um compromisso e outro. Os materiais são muito bem feitos." },
  { name: "Priscila Andrade", role: "Professora infantil", quote: "Os professores respondem as dúvidas de verdade. Me senti acompanhada do começo ao fim — e ainda recebi o certificado." },
];

export const BENEFITS = [
  { icon: "clock", title: "No seu ritmo", text: "Aulas curtas e objetivas que cabem na sua rotina, no computador ou no celular." },
  { icon: "users", title: "Acompanhamento real", text: "Professores e monitores respondem dúvidas e corrigem atividades." },
  { icon: "award", title: "Certificado validável", text: "Ao concluir, receba um certificado com código único e QR Code." },
  { icon: "book-open", title: "Fiel às Escrituras", text: "Conteúdo preparado pela equipe de ensino da Igreja Batista Atitude." },
];

export const ACHIEVEMENTS = [
  { key: "first-lesson", name: "Primeiro passo", description: "Concluiu a primeira aula.", icon: "footprints", xp: 10, criteria: { metric: "lessons_completed", count: 1 } },
  { key: "ten-lessons", name: "Constância", description: "Concluiu 10 aulas.", icon: "flame", xp: 30, criteria: { metric: "lessons_completed", count: 10 } },
  { key: "fifty-lessons", name: "Estudante dedicado", description: "Concluiu 50 aulas.", icon: "library", xp: 100, criteria: { metric: "lessons_completed", count: 50 } },
  { key: "first-course", name: "Curso concluído", description: "Concluiu o primeiro curso.", icon: "graduation-cap", xp: 50, criteria: { metric: "courses_completed", count: 1 } },
  { key: "three-courses", name: "Formação contínua", description: "Concluiu 3 cursos.", icon: "medal", xp: 150, criteria: { metric: "courses_completed", count: 3 } },
  { key: "quiz-master", name: "Aprovado", description: "Foi aprovado em 3 avaliações.", icon: "badge-check", xp: 40, criteria: { metric: "quizzes_passed", count: 3 } },
  { key: "streak-7", name: "Uma semana firme", description: "Estudou 7 dias seguidos.", icon: "calendar-check", xp: 50, criteria: { metric: "streak_days", count: 7 } },
  { key: "first-thread", name: "Voz na comunidade", description: "Iniciou uma discussão na comunidade.", icon: "messages-square", xp: 10, criteria: { metric: "threads_created", count: 1 } },
];

export const THREADS = [
  { title: "Qual tradução da Bíblia vocês recomendam para estudo?", type: "QUESTION", body: "Estou começando o Panorama do AT e fiquei em dúvida sobre qual tradução usar para estudo mais aprofundado. Alguma recomendação?", course: 0, pinned: false, solved: true },
  { title: "Boas-vindas à comunidade da Escola! Leia antes de postar", type: "DISCUSSION", body: "Este é o espaço para compartilhar aprendizados, tirar dúvidas e encorajar uns aos outros. Seja gentil, cite as referências bíblicas e evite debates que não edificam.", course: null, pinned: true, solved: false },
  { title: "Como vocês organizam o tempo de estudo durante a semana?", type: "DISCUSSION", body: "Trabalho o dia todo e tenho dificuldade de manter constância. Quem tiver uma rotina que funciona, compartilha aqui!", course: null, pinned: false, solved: false },
  { title: "Diferença entre profetas maiores e menores", type: "QUESTION", body: "A diferença é sobre importância ou sobre o tamanho dos livros?", course: 0, pinned: false, solved: true },
  { title: "Compartilhe: um salmo que marcou sua semana", type: "DISCUSSION", body: "Para a atividade do módulo 3, escolhi o Salmo 23. Qual foi o de vocês?", course: 0, pinned: false, solved: false },
  { title: "Dica de material sobre gêneros literários", type: "QUESTION", body: "Alguém tem indicação de leitura complementar sobre narrativa hebraica?", course: 2, pinned: false, solved: false },
];

export const REPLIES = [
  "Para estudo, gosto muito de comparar duas traduções: uma mais literal e outra mais dinâmica. Ajuda a perceber nuances.",
  "Excelente pergunta! O professor comentou isso na aula 2 — vale rever o trecho sobre contexto.",
  "Eu separo 20 minutos logo cedo, antes de abrir o celular. Tem funcionado!",
  "A classificação é pelo tamanho dos livros, não pela importância da mensagem.",
  "Obrigado por compartilhar, me ajudou muito!",
  "Recomendo começar pelo material de apoio em PDF do módulo 2, ele tem uma bibliografia no final.",
];
