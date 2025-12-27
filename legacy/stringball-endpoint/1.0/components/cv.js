export function renderCV() {
  return `
    <div class="cv-content">
      <div class="profile">
        <img src="Edwini.jpeg" alt="Edwin's Profile Picture">
        <h1>Edwin Isaac Estrada Rodriguez</h1>
        <p>Software Developer | Technical Support Engineer | Salesforce Expert</p>
        <p>📧 edwin.estro@me.com | 📞 +52 914 132 0191 | 
          <a href="https://www.linkedin.com/in/edwinestro" target="_blank">LinkedIn</a>
          <a href="https://www.github.com/edwinestro" target="_blank">GitHub</a>
        </p>
      </div>

      <section id="cv" class="section">
        <h2>Summary</h2>
        <p>Salesforce Developer with 3 years of experience delivering innovative solutions. Proven ability to bridge the gap between business needs and technical implementation, with a deep understanding of the digital transformation landscape and the potential of AI. Seeking a challenging Software Developer role to leverage my expertise and certifications in designing and implementing transformative Salesforce solutions.</p>
      </section>

      <section class="section">
        <h2>Experience</h2>
        ${renderExperience()}
      </section>

      <section class="section">
        <h2>Certifications</h2>
        <ul>
          ${[
            'Salesforce Certified Associate',
            'Salesforce Certified AI Associate',
            'Salesforce Certified Administrator',
            'Salesforce Certified Developer I',
            'Salesforce Certified Agentforce Specialist',
            'Salesforce Certified App Builder',
            'Salesforce Certified Service Cloud Consultant',
            'Copado Fundamentals I',
            'Udemy Test Driven Development',
            'Udemy Java Design Patterns',
            'CSP I Service Ready'
          ].map(cert => `<li>${cert}</li>`).join('')}
        </ul>
      </section>

      <section class="section">
        <h2>Education</h2>
        <p><strong>University of the People</strong> – Bachelor’s Degree in Computer Science | 2025 - Present</p>
        <p><strong>Universidad de Málaga</strong> – Computer Engineering (Incomplete) | 2019 - 2020 <code>pandemic</code></p>
        <p><strong>UNAM</strong> – Civil Engineering (Incomplete) | 2010 - 2015</p>
      </section>

      <section class="section">
        <h2>Languages</h2>
        <p>🇪🇸 Spanish (Native) | 🇬🇧 English (C2 CEFR) | 🇫🇷 French (Advanced) | 🇧🇷 Portuguese (Intermediate)</p>
      </section>
    </div>
  `;
}

function renderExperience() {
  const jobs = [
    {
      title: 'Salesforce Developer',
      company: 'CBQA Solutions Inc.',
      location: 'Remote',
      dates: 'July 2025 – Present',
      description: `Developed Salesforce applications as part of a Team as a Service (TaaS) effort, delivering CRM functionality and integrations. Collaborated with cross-functional teams to implement automation and optimize CI/CD pipelines. Helped bring features from design to production in an agile environment.`,
      skills: ['Apex', 'JavaScript', 'Test Automation', 'Selenium', 'QA Testing', 'Git', 'DevOps', 'Jira', 'Agile Methodology']
    },
    {
      title: 'Technical Support Engineer',
      company: 'Salesforce',
      location: 'Mexico City, MX',
      dates: 'August 2024 – May 2025',
      description: `Top performer providing expert technical support, troubleshooting and resolving complex issues across Sales, Service, and Experience Clouds. Analyzed and diagnosed technical problems, escalated critical issues, and documented solutions for knowledge base articles. Maintained 100% SLA compliance and achieved a 4.96/5 customer satisfaction score with 150% productivity.`,
      skills: ['Apex', 'JavaScript', 'Splunk', 'DevOps', 'Git', 'Scrum', 'SAML']
    },
    {
      title: 'Salesforce Developer Analyst',
      company: 'Deloitte',
      location: 'Queretaro, MX',
      dates: '2022 – 2024',
      description: `Led Salesforce Service Cloud enhancements for Fintech projects, ensuring accurate SLA tracking and automation of key business workflows. Developed and deployed custom applications and integrations while implementing CI/CD practices. Eliminated deprecated functionalities, freeing 20% of Apex Character Utilization, and achieved 100% code coverage on scoped Apex Classes through test class fixes.`,
      skills: ['Apex', 'JavaScript', 'HTML', 'CSS', 'Java', 'Python', 'Git', 'DevOps', 'Agile Methodology', 'Jira']
    }
  ];

  return jobs.map(job => `
    <h3>${job.title} – ${job.company} | ${job.location} | ${job.dates}</h3>
    <p>${job.description}</p>
    <p><strong>Skills:</strong> ${job.skills.join(', ')}</p>
  `).join('');
}
