"""
Company-specific interview patterns — used as seed knowledge when web search
returns poor results. Based on publicly documented interview styles.
"""

COMPANY_PATTERNS = {
    "google": {
        "style": "Focus on algorithmic problem-solving, system design at massive scale, and 'Googleyness' behavioral questions",
        "technical_emphasis": ["algorithm optimization", "distributed systems", "scalability to billions of users"],
        "question_types": [
            "Design a system like YouTube/Gmail/Maps at Google scale",
            "Optimize this algorithm from O(n²) to O(n log n)",
            "How would you handle data consistency across global data centers",
        ],
        "what_they_probe": "Can you think at Google scale? Do you consider edge cases? Can you optimize beyond the obvious solution?",
    },
    "amazon": {
        "style": "Leadership Principles drive every question. Technical depth + operational excellence + customer obsession",
        "technical_emphasis": ["system design with cost optimization", "operational excellence", "scalable microservices"],
        "question_types": [
            "Tell me about a time you disagreed with your manager (LP: Have Backbone)",
            "Design an order tracking system with 99.99% availability",
            "How would you debug a production outage affecting millions of customers",
        ],
        "what_they_probe": "Do you think about cost? Do you own problems end-to-end? Can you make data-driven decisions?",
    },
    "meta": {
        "style": "Move fast. Product sense matters as much as code. Heavy on coding speed and system design with social graph",
        "technical_emphasis": ["coding speed and correctness", "social graph problems", "product-minded engineering"],
        "question_types": [
            "Code a working solution in 20 minutes",
            "Design News Feed ranking at Meta scale",
            "How would you measure the success of this feature from an engineering perspective",
        ],
        "what_they_probe": "Can you code fast AND correctly? Do you understand product impact? Can you design for billions of connections?",
    },
    "apple": {
        "style": "Deep technical depth in your specific domain. Quality over speed. Privacy-first thinking",
        "technical_emphasis": ["domain expertise depth", "performance optimization", "privacy-by-design"],
        "question_types": [
            "Explain the internals of [technology from resume] in detail",
            "How would you optimize this for battery life and memory",
            "Design this feature with privacy as a first-class concern",
        ],
        "what_they_probe": "How deep is your expertise? Do you care about craft and quality? Can you think about privacy implications?",
    },
    "microsoft": {
        "style": "Growth mindset questions. System design for enterprise scale. Collaborative problem-solving",
        "technical_emphasis": ["enterprise-scale systems", "cloud architecture (Azure)", "collaborative design"],
        "question_types": [
            "Design a system that handles 10M enterprise users with strict SLAs",
            "How would you migrate this monolith to microservices incrementally",
            "Walk me through how you'd onboard a new team member to this codebase",
        ],
        "what_they_probe": "Can you think about enterprise requirements? Are you collaborative? Do you have a growth mindset?",
    },
    "netflix": {
        "style": "Freedom and responsibility culture. Deep system design. Data-driven decision making",
        "technical_emphasis": ["streaming at scale", "A/B testing infrastructure", "chaos engineering"],
        "question_types": [
            "Design a video recommendation system",
            "How would you ensure zero-downtime deployments",
            "Describe how you'd implement A/B testing for a new feature",
        ],
        "what_they_probe": "Can you operate with high autonomy? Do you make decisions backed by data? Can you handle scale?",
    },
    "stripe": {
        "style": "API design excellence. Financial system reliability. Developer experience focus",
        "technical_emphasis": ["API design", "payment system reliability", "idempotency and consistency"],
        "question_types": [
            "Design a payment API that handles retries safely",
            "How do you ensure exactly-once processing in a distributed payment system",
            "Design a developer-friendly webhook system",
        ],
        "what_they_probe": "Do you understand financial system constraints? Can you design clean APIs? Do you think about developer experience?",
    },
    "openai": {
        "style": "Deep ML/AI research depth. Systems that scale AI. Safety-aware thinking",
        "technical_emphasis": ["LLM internals", "ML infrastructure at scale", "safety and alignment thinking"],
        "question_types": [
            "How would you design a training pipeline for a large language model",
            "What are the key design decisions in building a vector database for RAG",
            "How would you detect and mitigate hallucinations in production LLM systems",
        ],
        "what_they_probe": "Do you understand ML at a deep technical level? Can you think about AI safety? Can you bridge research and production?",
    },
    "uber": {
        "style": "Real-time systems, geospatial problems, marketplace dynamics, reliability at scale",
        "technical_emphasis": ["real-time matching systems", "geospatial indexing", "distributed reliability"],
        "question_types": [
            "Design a real-time ride-matching system that minimizes wait time",
            "How would you handle surge pricing at city scale with millions of concurrent users",
            "Design Uber's driver location tracking system",
        ],
        "what_they_probe": "Can you think in real-time constraints? Do you understand marketplace dynamics? Can you build for reliability?",
    },
    "airbnb": {
        "style": "Product-minded engineering, search and recommendation, trust and safety",
        "technical_emphasis": ["search ranking", "trust and safety systems", "full-stack product thinking"],
        "question_types": [
            "Design Airbnb's search ranking algorithm",
            "How would you build a fraud detection system for booking payments",
            "Design a review system that surfaces trustworthy signals",
        ],
        "what_they_probe": "Do you understand product context? Can you build trust at scale? Do you think about community impact?",
    },
}

# Generic fallback for unknown companies
DEFAULT_PATTERN = {
    "style": "Standard technical interview with system design, coding, and behavioral components",
    "technical_emphasis": ["problem-solving", "system design", "code quality"],
    "question_types": [
        "Design a core feature of the company's product at scale",
        "Solve a real-world problem using the JD tech stack",
        "Walk through a project from your resume in depth",
    ],
    "what_they_probe": "Technical competence, problem-solving approach, communication clarity",
}


def get_company_pattern(company: str) -> dict:
    """Look up interview patterns for a company (case-insensitive, partial match)."""
    company_lower = company.lower().strip()
    for key, pattern in COMPANY_PATTERNS.items():
        if key in company_lower or company_lower in key:
            return pattern
    return DEFAULT_PATTERN
