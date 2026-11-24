/* ==========================================================================
   PORTFOLIO DATA — Single source of truth for all portfolio content
   ========================================================================== */

export const portfolioData = {
  profile: {
    name: 'Aayush Kumar Gupta',
    title: 'Creative Developer & Security Enthusiast',
    location: 'Kathmandu, Nepal',
    university: 'Lord Buddha Education Foundation (Asia Pacific University)',
    avatar: './images/About Me.JPG',
    bio: `I am a Computer Science and IT student driven by a passion for building robust software and understanding modern system architectures. My technical focus spans cross-platform application development, network security, and digital forensics. From engineering desktop applications in C++ and Python—such as the open-source Nepali Date Widget—to exploring vulnerability analysis and system integrity, I bridge code craft with core security fundamentals.`,
    bioExtended: `Beyond engineering, I share hardware insights and tech tutorials through my YouTube channel, GupLogy, constantly aiming to turn complex technical challenges into clean, open-source solutions.`,
    interests: ['Open Source Contributor', 'Tech YouTuber (GupLogy)', 'Hardware Enthusiast', 'Cybersecurity Researcher'],
    goals: 'To build secure, elegant software and bridge the gap between usability and system integrity—while helping others learn through open-source and content creation.'
  },

  social: {
    github: 'https://github.com/aayushlbef',
    linkedin: 'https://www.linkedin.com/in/guptakaayush/',
    twitter: 'https://x.com/Aayush2326v',
    youtube: 'https://youtube.com/@GupLogy',
    whatsapp: 'https://wa.me/9779767250246',
    email: 'mailto:aayushgupta@example.com'
  },

  projects: [
    {
      title: 'Nepali Date Widget',
      description: 'An open-source cross-platform desktop widget displaying the Nepali (Bikram Sambat) date. Built with Python and designed for minimal resource usage.',
      image: './calendar-window.png',
      technologies: ['Python', 'Tkinter', 'Cross-Platform'],
      github: 'https://github.com/aayushlbef',
      demo: null
    },
    {
      title: 'Health Management System',
      description: 'A comprehensive health records management application for tracking patient data, appointments, and medical histories.',
      image: './health.png',
      technologies: ['C++', 'Database', 'Desktop App'],
      github: 'https://github.com/aayushlbef',
      demo: null
    },
    {
      title: 'Movie Ticket Booking',
      description: 'A movie ticket booking application with seat selection, showtime management, and booking confirmation features.',
      image: './movie-ticket.png',
      technologies: ['Python', 'GUI', 'Database'],
      github: 'https://github.com/aayushlbef',
      demo: null
    },
    {
      title: 'Restaurant Management',
      description: 'A restaurant order and table management system with menu display, order tracking, and billing functionalities.',
      image: './resturant.png',
      technologies: ['Python', 'Desktop App', 'Database'],
      github: 'https://github.com/aayushlbef',
      demo: null
    },
    {
      title: 'Terminal Portfolio',
      description: 'An interactive terminal-style portfolio website that emulates a command-line interface for a unique browsing experience.',
      image: './terminal.png',
      technologies: ['JavaScript', 'HTML/CSS', 'CLI Design'],
      github: 'https://github.com/aayushlbef',
      demo: null
    },
    {
      title: 'Todo Application',
      description: 'A clean, feature-rich todo application with task categories, priorities, deadlines, and persistent storage.',
      image: './todo.png',
      technologies: ['JavaScript', 'HTML/CSS', 'LocalStorage'],
      github: 'https://github.com/aayushlbef',
      demo: null
    }
  ],

  certificates: [
    {
      title: 'AI & Robotics 4-Days Learning',
      issuer: 'Workshop Certificate',
      date: '2024',
      image: './images/certificates/AI & Robotics 4 - Days Learning Certificates.png'
    },
    {
      title: 'Foundations of Cybersecurity',
      issuer: 'Coursera — Google',
      date: '2024',
      image: './images/certificates/Coursera Foundation of Cyber Security.png'
    },
    {
      title: 'Play It Safe: Manage Security Risks',
      issuer: 'Coursera — Google',
      date: '2024',
      image: './images/certificates/Coursera Play It Safe.png'
    },
    {
      title: 'GitHub Foundations',
      issuer: 'GitHub',
      date: '2024',
      image: './images/certificates/Github Certificate.png'
    },
    {
      title: 'Professional Certificate I',
      issuer: 'Certified Program',
      date: '2024',
      image: './images/certificates/cert-01.jpg'
    },
    {
      title: 'Professional Certificate II',
      issuer: 'Certified Program',
      date: '2024',
      image: './images/certificates/cert-02.jpg'
    },
    {
      title: 'Professional Certificate III',
      issuer: 'Certified Program',
      date: '2024',
      image: './images/certificates/cert-03.jpg'
    },
    {
      title: 'Professional Certificate IV',
      issuer: 'Certified Program',
      date: '2024',
      image: './images/certificates/cert-04.jpg'
    }
  ],

  skills: {
    languages: [
      { name: 'C++', icon: 'fas fa-code' },
      { name: 'Python', icon: 'fab fa-python' },
      { name: 'JavaScript', icon: 'fab fa-js' },
      { name: 'TypeScript', icon: 'fas fa-code' },
      { name: 'Java', icon: 'fab fa-java' },
      { name: 'SQL', icon: 'fas fa-database' }
    ],
    frontend: [
      { name: 'HTML5', icon: 'fab fa-html5' },
      { name: 'CSS3', icon: 'fab fa-css3-alt' },
      { name: 'React', icon: 'fab fa-react' },
      { name: 'Tailwind CSS', icon: 'fas fa-wind' },
      { name: 'Three.js', icon: 'fas fa-cube' }
    ],
    backend: [
      { name: 'Node.js', icon: 'fab fa-node-js' },
      { name: 'Express', icon: 'fas fa-server' },
      { name: 'REST APIs', icon: 'fas fa-plug' }
    ],
    databases: [
      { name: 'MySQL', icon: 'fas fa-database' },
      { name: 'MongoDB', icon: 'fas fa-leaf' },
      { name: 'SQLite', icon: 'fas fa-database' }
    ],
    tools: [
      { name: 'Git / GitHub', icon: 'fab fa-git-alt' },
      { name: 'VS Code', icon: 'fas fa-laptop-code' },
      { name: 'Linux', icon: 'fab fa-linux' },
      { name: 'Docker', icon: 'fab fa-docker' },
      { name: 'Wireshark', icon: 'fas fa-shield-alt' },
      { name: 'Figma', icon: 'fab fa-figma' }
    ]
  },

  experience: [
    {
      role: 'Open Source Contributor',
      company: 'GitHub Community',
      period: '2023 — Present',
      description: 'Contributing to open-source projects including cross-platform desktop tools and security utilities. Building and maintaining the Nepali Date Widget used by hundreds of users.',
      type: 'work'
    },
    {
      role: 'Tech Content Creator',
      company: 'GupLogy — YouTube',
      period: '2022 — Present',
      description: 'Creating tech tutorials, hardware reviews, and programming walkthroughs. Covering topics from system builds to network security concepts for a growing audience.',
      type: 'work'
    },
    {
      role: 'CS & IT Student',
      company: 'Lord Buddha Education Foundation',
      period: '2023 — Present',
      description: 'Pursuing Computer Science & IT with focus on software development, system architecture, network security, and digital forensics. Affiliated with Asia Pacific University.',
      type: 'training'
    },
    {
      role: 'AI & Robotics Workshop',
      company: 'Workshop Training',
      period: '2024',
      description: 'Completed intensive 4-day workshop on artificial intelligence fundamentals and robotics programming, covering machine learning basics and hardware integration.',
      type: 'training'
    }
  ],

  desktopFolders: [
    { id: 'about', label: 'About Me', iconType: 'folder' },
    { id: 'projects', label: 'Projects', iconType: 'folder' },
    { id: 'certificates', label: 'Certificates', iconType: 'folder' },
    { id: 'skills', label: 'Technical Skills', iconType: 'folder' },
    { id: 'experience', label: 'Experience', iconType: 'folder' },
    { id: 'contact', label: 'Contact', iconType: 'folder' },
    { id: 'resume', label: 'Resume.pdf', iconType: 'file' }
  ]
};
