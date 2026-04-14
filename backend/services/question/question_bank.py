"""
Technical Interview Question Bank
Curated from GeeksForGeeks, HackerRank, LeetCode frequently asked questions
Organized by role and technology
"""

# Data Structures & Algorithms - Most Asked (GFG/LeetCode/HackerRank Top 100)
DSA_QUESTIONS = {
    "arrays": [
        "Given an array of integers, find two numbers that add up to a specific target. What's the most efficient approach and its time complexity?",
        "How would you find the maximum subarray sum in O(n) time? Explain Kadane's algorithm.",
        "Implement an algorithm to rotate an array by k positions. What are the different approaches and their trade-offs?",
        "How do you find the missing number in an array of 1 to n? Can you do it in O(1) space?",
        "Explain how you would merge two sorted arrays without using extra space.",
    ],
    "linked_lists": [
        "How would you detect a cycle in a linked list? Explain Floyd's cycle detection algorithm.",
        "Reverse a linked list both iteratively and recursively. What are the space complexities?",
        "How do you find the middle element of a linked list in one pass?",
        "Merge two sorted linked lists. What's the time and space complexity?",
        "How would you detect the starting node of a cycle in a linked list?",
    ],
    "trees": [
        "Explain the difference between DFS and BFS traversal. When would you use each?",
        "How do you determine if a binary tree is balanced? What's the time complexity?",
        "Find the lowest common ancestor of two nodes in a binary tree. Explain your approach.",
        "Serialize and deserialize a binary tree. What format would you use and why?",
        "How would you convert a BST to a sorted doubly linked list in-place?",
    ],
    "graphs": [
        "Explain Dijkstra's algorithm. When would it fail and what would you use instead?",
        "How do you detect a cycle in a directed graph? What about an undirected graph?",
        "Implement topological sort. What are its applications in real-world systems?",
        "How would you find the shortest path in an unweighted graph?",
        "Explain Union-Find data structure. How would you optimize it?",
    ],
    "dynamic_programming": [
        "Explain the difference between top-down and bottom-up DP approaches with an example.",
        "How do you identify if a problem can be solved using dynamic programming?",
        "Solve the longest common subsequence problem. What's the time and space complexity?",
        "Explain the coin change problem and its variations.",
        "How would you optimize DP space complexity from O(n²) to O(n)?",
    ],
    "system_design_dsa": [
        "Design a LRU Cache. What data structures would you use and why?",
        "Implement a rate limiter. What are different algorithms you could use?",
        "Design a data structure that supports insert, delete, and getRandom in O(1).",
        "How would you implement an autocomplete system? What data structures are optimal?",
        "Design a hit counter that counts hits in the past 5 minutes.",
    ]
}

# System Design Questions - FAANG Style
SYSTEM_DESIGN_QUESTIONS = {
    "scalability": [
        "Design a URL shortener like bit.ly that can handle 100M daily active users.",
        "How would you design Twitter's trending topics feature to handle real-time updates?",
        "Design a distributed cache system. How would you handle cache invalidation?",
        "How would you scale a database from 1 server to handling 10 million QPS?",
        "Design a notification system that can send 1 billion notifications per day.",
    ],
    "distributed_systems": [
        "Explain the CAP theorem with real-world examples. How would you choose between consistency and availability?",
        "Design a distributed task scheduler. How would you handle worker failures?",
        "How would you implement distributed locks? What are the challenges?",
        "Design a system for exactly-once message delivery. What protocols would you use?",
        "Explain different consensus algorithms (Paxos, Raft). When would you use each?",
    ],
    "databases": [
        "When would you choose NoSQL over SQL? Give specific examples.",
        "How would you design a sharding strategy for a user database?",
        "Explain database indexing. How would you design indexes for a high-read system?",
        "Design a multi-region database replication strategy. How would you handle conflicts?",
        "How would you implement a search feature on billions of records?",
    ],
    "real_time": [
        "Design a real-time chat application like WhatsApp for millions of users.",
        "How would you implement a live video streaming platform like Twitch?",
        "Design a collaborative document editing system like Google Docs.",
        "How would you build a real-time multiplayer game server?",
        "Design a stock trading platform that requires sub-millisecond latency.",
    ]
}

# Role-Specific Technical Questions
ROLE_QUESTIONS = {
    "backend": [
        "Explain the difference between REST and GraphQL. When would you choose one over the other?",
        "How do you handle database deadlocks in a high-concurrency environment?",
        "Explain microservices vs monolithic architecture. What are the trade-offs?",
        "How would you implement an API rate limiter? What algorithms are available?",
        "Explain event-driven architecture. How does it differ from request-response?",
        "How do you ensure API backward compatibility during deployments?",
        "Explain different authentication methods (JWT, OAuth, Session). When would you use each?",
        "How would you design a circuit breaker pattern for external API calls?",
    ],
    "frontend": [
        "Explain the Virtual DOM in React. How does reconciliation work?",
        "How would you optimize a React application with thousands of list items?",
        "Explain the difference between CSR, SSR, and SSG. When would you use each?",
        "How do you handle state management in large React applications?",
        "Explain how browser rendering works. What causes layout thrashing?",
        "How would you implement infinite scrolling performantly?",
        "Explain Web Workers. When would you use them?",
        "How do you optimize bundle size in a large JavaScript application?",
    ],
    "fullstack": [
        "How do you handle authentication across frontend and backend?",
        "Explain CORS. How would you configure it for a production application?",
        "How would you implement real-time features in a web application?",
        "Design an end-to-end file upload system for large files.",
        "How do you handle optimistic UI updates?",
        "Explain WebSocket vs Server-Sent Events. When would you use each?",
    ],
    "devops": [
        "Explain the difference between horizontal and vertical scaling.",
        "How would you design a CI/CD pipeline for a microservices architecture?",
        "Explain Kubernetes pod lifecycle. How do you handle graceful shutdowns?",
        "How would you implement blue-green vs canary deployments?",
        "Explain Infrastructure as Code. What tools have you used?",
        "How would you design a logging and monitoring strategy for distributed systems?",
    ],
    "data_engineer": [
        "Design a data pipeline that processes 1TB of data daily.",
        "Explain the difference between batch and stream processing. When would you use each?",
        "How would you handle late-arriving data in a streaming system?",
        "Design an ETL pipeline with exactly-once semantics.",
        "Explain data partitioning strategies. How do you avoid data skew?",
    ],
    "ml_engineer": [
        "How do you deploy machine learning models to production?",
        "Explain feature store architecture. Why is it important?",
        "How would you handle model drift in production?",
        "Design an A/B testing framework for ML models.",
        "Explain the challenges of serving ML models at scale.",
    ],
    "security": [
        "Explain the difference between Symmetric and Asymmetric encryption.",
        "How would you prevent SQL Injection and XSS attacks? internal mechanics?",
        "Explain the concept of Zero Trust Security architecture.",
        "How does OAuth 2.0 work? Explain the different grant types.",
        "Describe how you would handle a DDoS attack in real-time.",
        "What is a Man-in-the-Middle attack and how can it be prevented?",
        "Explain how HTTPS/TLS handshakes work in detail.",
        "How would you secure a microservices architecture?",
        "Check for common vulnerabilities in this code snippet (provide mental snippet).",
        "Explain the CIA triad (Confidentiality, Integrity, Availability) with examples."
    ]
}


# Technology-Specific Deep Dive Questions
TECHNOLOGY_QUESTIONS = {
    "python": [
        "Explain Python's GIL. How does it affect multithreading and what are alternatives?",
        "What's the difference between __new__ and __init__? When would you override __new__?",
        "Explain Python's garbage collection. How does reference counting work with cycles?",
        "What are metaclasses? Give a practical use case.",
        "Explain async/await in Python. How does the event loop work?",
        "What's the difference between deepcopy and copy? When would you use each?",
    ],
    "javascript": [
        "Explain the JavaScript event loop. What's the difference between microtasks and macrotasks?",
        "What's the difference between var, let, and const? Explain hoisting.",
        "Explain closures with a practical example. What are common pitfalls?",
        "How does prototypal inheritance work in JavaScript?",
        "Explain Promises vs async/await. What are the error handling differences?",
        "What's debouncing vs throttling? Implement both.",
    ],
    "java": [
        "Explain Java's memory model. What's the difference between heap and stack?",
        "How does garbage collection work in Java? Explain different GC algorithms.",
        "What's the difference between synchronized, volatile, and locks?",
        "Explain the Java Stream API. How does lazy evaluation work?",
        "What are the differences between HashMap, ConcurrentHashMap, and Hashtable?",
    ],
    "go": [
        "Explain goroutines vs threads. How does Go's scheduler work?",
        "What are channels? Explain buffered vs unbuffered channels.",
        "How does garbage collection work in Go?",
        "Explain Go's interface implementation. How is it different from Java?",
        "What's the purpose of defer? Explain execution order with multiple defers.",
    ],
    "kubernetes": [
        "Explain the difference between Deployment, StatefulSet, and DaemonSet.",
        "How does Kubernetes networking work? Explain Services and Ingress.",
        "What are init containers? Give a practical use case.",
        "How would you implement rolling updates with zero downtime?",
        "Explain resource limits and requests. What happens when a pod exceeds limits?",
    ],
    "aws": [
        "Explain the difference between SQS, SNS, and EventBridge. When would you use each?",
        "How would you design a multi-region architecture for high availability?",
        "Explain Lambda cold starts. How would you minimize them?",
        "What's the difference between Application Load Balancer and Network Load Balancer?",
        "How does DynamoDB handle reads and writes? Explain partition keys and GSIs.",
    ],
    "docker": [
        "Explain Docker layers. How would you optimize a Dockerfile for faster builds?",
        "What's the difference between CMD and ENTRYPOINT?",
        "How does Docker networking work? Explain bridge, host, and overlay networks.",
        "Explain multi-stage builds. What are the benefits?",
        "How would you reduce Docker image size for production?",
    ],
    "sql": [
        "Explain different types of JOINs with examples. When would you use each?",
        "How do database indexes work? What's a covering index?",
        "Explain transaction isolation levels. What's the trade-off between each?",
        "How would you optimize a slow query? What tools would you use?",
        "Explain the difference between clustered and non-clustered indexes.",
    ],
    "redis": [
        "Explain Redis data types. When would you use each?",
        "How does Redis persistence work? Explain RDB vs AOF.",
        "What's Redis Cluster? How does sharding work?",
        "Explain Redis pub/sub. What are its limitations?",
        "How would you implement a distributed lock using Redis?",
    ]
}

# Behavioral Questions for Tech Roles
BEHAVIORAL_QUESTIONS = [
    "Tell me about a time when you had to make a critical technical decision with incomplete information.",
    "Describe a situation where you had to debug a complex production issue under pressure.",
    "Tell me about a time when you disagreed with a technical decision. How did you handle it?",
    "Describe a project where you had to learn a new technology quickly. How did you approach it?",
    "Tell me about a time when you improved the performance of an existing system significantly.",
    "Describe a situation where you had to balance technical debt with feature delivery.",
    "Tell me about a time when you mentored a junior developer. What was your approach?",
    "Describe a conflict you had with a team member over technical approaches. How was it resolved?",
]

def get_questions_for_role(role: str, technologies: list, count: int = 5) -> list:
    """Get a curated mix of questions based on role and technologies"""
    import random
    
    questions = []
    role_lower = role.lower()
    
    # Determine role category
    role_category = "backend"  # default
    if "frontend" in role_lower or "react" in role_lower or "ui" in role_lower:
        role_category = "frontend"
    elif "full" in role_lower or "stack" in role_lower:
        role_category = "fullstack"
    elif "devops" in role_lower or "sre" in role_lower or "platform" in role_lower:
        role_category = "devops"
    elif "data" in role_lower and "engineer" in role_lower:
        role_category = "data_engineer"
    elif "ml" in role_lower or "machine learning" in role_lower:
        role_category = "ml_engineer"
    elif "security" in role_lower or "cyber" in role_lower or "infosec" in role_lower:
        role_category = "security"
    
    # Add role-specific questions

    if role_category in ROLE_QUESTIONS:
        questions.extend(random.sample(ROLE_QUESTIONS[role_category], min(2, len(ROLE_QUESTIONS[role_category]))))
    
    # Add technology-specific questions
    for tech in technologies:
        tech_lower = tech.lower().strip()
        for tech_key in TECHNOLOGY_QUESTIONS:
            if tech_key in tech_lower or tech_lower in tech_key:
                questions.extend(random.sample(TECHNOLOGY_QUESTIONS[tech_key], min(2, len(TECHNOLOGY_QUESTIONS[tech_key]))))
                break
    
    # Add DSA questions (always important)
    dsa_categories = list(DSA_QUESTIONS.keys())
    random.shuffle(dsa_categories)
    for cat in dsa_categories[:2]:
        questions.extend(random.sample(DSA_QUESTIONS[cat], 1))
    
    # Add system design for senior roles
    if "senior" in role_lower or "lead" in role_lower or "staff" in role_lower:
        sd_categories = list(SYSTEM_DESIGN_QUESTIONS.keys())
        random.shuffle(sd_categories)
        questions.extend(random.sample(SYSTEM_DESIGN_QUESTIONS[sd_categories[0]], 1))
    
    # Add one behavioral
    questions.extend(random.sample(BEHAVIORAL_QUESTIONS, 1))
    
    # Shuffle and return
    random.shuffle(questions)
    return questions[:count]
