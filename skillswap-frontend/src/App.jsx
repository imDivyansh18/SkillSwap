import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import {
  ArrowRightLeft,
  Sparkles,
  Search,
  Users,
  BookOpen,
  MessageCircle,
  UserRound,
  Settings,
  Bell,
  Check,
  Plus,
  X,
  Menu,
} from "lucide-react";
import "./App.css";

const initialMatches = [
  {
    id: 1,
    name: "Alex Morgan",
    role: "UI/UX Designer",
    initials: "AM",
    color: "blue",
    teaches: ["Figma", "UI Design"],
    learns: ["Python", "Data Science"],
    score: 95,
    level: "Intermediate",
    bio: "I love designing intuitive digital experiences and helping people get started with Figma.",
  },
  {
    id: 2,
    name: "Priya Sharma",
    role: "Full-stack Developer",
    initials: "PS",
    color: "purple",
    teaches: ["React.js", "Node.js"],
    learns: ["UI Design", "Figma"],
    score: 91,
    level: "Expert",
    bio: "Building web applications and sharing practical frontend development knowledge.",
  },
  {
    id: 3,
    name: "Rahul Verma",
    role: "Python Developer",
    initials: "RV",
    color: "orange",
    teaches: ["Python", "SQL"],
    learns: ["React.js", "Web Design"],
    score: 87,
    level: "Intermediate",
    bio: "Interested in Python, data analytics, automation, and building useful projects.",
  },
  {
    id: 4,
    name: "Ananya Singh",
    role: "Frontend Developer",
    initials: "AS",
    color: "pink",
    teaches: ["JavaScript", "HTML & CSS"],
    learns: ["Python", "Machine Learning"],
    score: 84,
    level: "Intermediate",
    bio: "I enjoy creating accessible interfaces and exploring machine learning projects.",
  },
];

const initialSkills = {
  teach: ["HTML & CSS", "JavaScript"],
  learn: ["React.js", "Python"],
};

function Avatar({ person, large = false }) {
  return (
    <div className={`avatar ${person.color} ${large ? "avatar-large" : ""}`}>
      {person.initials}
    </div>
  );
}

function SkillTags({ skills, type }) {
  return (
    <div className="skill-tags">
      {skills.map((skill) => (
        <span className={`skill-tag ${type}`} key={skill}>
          {skill}
        </span>
      ))}
    </div>
  );
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";
}

function App() {
  const [page, setPage] = useState("Discover");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [connected, setConnected] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profileName, setProfileName] = useState("Divyanshu");
  const [skills, setSkills] = useState(initialSkills);
  const [newSkill, setNewSkill] = useState("");
  const [skillType, setSkillType] = useState("learn");
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState(
    () => sessionStorage.getItem("skillswap_token") || ""
  );
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [matchData, setMatchData] = useState([]);
  const [apiError, setApiError] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileRole, setProfileRole] = useState("");


  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);

    try {
      const endpoint =
        authMode === "register" ? "/auth/register" : "/auth/login";

      const body =
        authMode === "register"
          ? {
            name: authName.trim(),
            email: authEmail.trim(),
            password: authPassword,
          }
          : {
            email: authEmail.trim(),
            password: authPassword,
          };

      const result = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      sessionStorage.setItem("skillswap_token", result.token);
      setCurrentUser(result.user);
      setToken(result.token);
      setAuthPassword("");
      setPage("Discover");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem("skillswap_token");
    setToken("");
    setCurrentUser(null);
    setMatchData([]);
    setConnected([]);
    setAuthMode("login");
    setAuthPassword("");
    setAuthError("");
    setAuthReady(false);
  }


  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setMatchData([]);
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    async function loadAccount() {
      setAuthReady(false);
      setApiError("");

      try {
        const profileResult = await apiRequest("/users/me", { token });
        const user = profileResult.user;

        if (cancelled) return;

        setCurrentUser(user);
        setProfileName(user.name || "");
        setProfileBio(user.bio || "");
        setProfileRole(user.role || "");

        setSkills({
          teach: (user.teaches || []).map((skill) => skill.name),
          learn: (user.learns || []).map((skill) => skill.name),
        });

        const result = await apiRequest("/matches", { token });

        if (cancelled) return;

        setMatchData(
          (result.matches || []).map((match) => ({
            id: String(match.user.id),
            name: match.user.name,
            role: match.user.role || "Skill Explorer",
            initials: (match.user.name || "?")
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            color: "blue",
            teaches: (match.user.teaches || []).map((skill) => skill.name),
            learns: (match.user.learns || []).map((skill) => skill.name),
            score: match.score,
            level: "Skill exchange",
            bio: match.user.bio || "",
            explanation: match.explanation,
          }))
        );
      } catch (error) {
        if (!cancelled) {
          if (error.message.toLowerCase().includes("token")) {
            logout();
          } else {
            setApiError(error.message);
          }
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [token]);


  const matches = initialMatches.filter((person) => {
    const searchable = [
      person.name,
      person.role,
      ...person.teaches,
      ...person.learns,
    ].join(" ").toLowerCase();

    const searchMatch = searchable.includes(search.toLowerCase());
    const filterMatch =
      filter === "All" ||
      person.teaches.includes(filter) ||
      person.learns.includes(filter);

    return searchMatch && filterMatch;
  });

  function navigate(nextPage) {
    setPage(nextPage);
    setMobileMenu(false);
    setSelected(null);
  }

  function toggleConnection(id) {
    setConnected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  }

  function addSkill(event) {
    event.preventDefault();
    const skill = newSkill.trim();
    if (!skill) return;

    setSkills((previous) => {
      const current = previous[skillType];
      if (current.some((item) => item.toLowerCase() === skill.toLowerCase())) {
        return previous;
      }
      return { ...previous, [skillType]: [...current, skill] };
    });

    setNewSkill("");
    setSaved(false);
  }

  function removeSkill(type, skill) {
    setSkills((previous) => ({
      ...previous,
      [type]: previous[type].filter((item) => item !== skill),
    }));
    setSaved(false);
  }

  const navItems = [
    { name: "Discover", icon: Users },
    { name: "My Learning", icon: BookOpen },
    { name: "Messages", icon: MessageCircle },
    { name: "My Profile", icon: UserRound },
  ];


  if (!authReady) {
    return <div className="auth-loading">Loading SkillSwap...</div>;
  }

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-brand">
            <ArrowRightLeft size={25} />
            <span>Skill<span>Swap</span></span>
          </div>

          <h1>
            {authMode === "register"
              ? "Create your account"
              : "Welcome back"}
          </h1>

          <p className="auth-subtitle">
            {authMode === "register"
              ? "Share your skills. Learn something new."
              : "Sign in to continue your learning journey."}
          </p>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === "register" && (
              <label>
                Full name
                <input
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  maxLength={80}
                  placeholder="Your name"
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                minLength={8}
                autoComplete={
                  authMode === "register"
                    ? "new-password"
                    : "current-password"
                }
                placeholder="At least 8 characters"
                required
              />
            </label>

            {authError && (
              <p className="auth-error" role="alert">{authError}</p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={authBusy}
            >
              {authBusy
                ? "Please wait..."
                : authMode === "register"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === "register"
              ? "Already have an account?"
              : "New to SkillSwap?"}{" "}
            <button
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === "register" ? "login" : "register"
                );
                setAuthError("");
              }}
            >
              {authMode === "register"
                ? "Sign in"
                : "Create an account"}
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a className="brand" href="#home" onClick={() => navigate("Discover")}>
          <span className="brand-mark">
            <ArrowRightLeft size={22} />
          </span>
          <span>Skill<span className="brand-accent">Swap</span></span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              className={`nav-item ${page === name ? "nav-active" : ""}`}
              key={name}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Messages" && connected.length > 0 && (
                <span className="nav-count">{connected.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-help">
          <div className="help-icon"><Sparkles size={19} /></div>
          <strong>Grow together</strong>
          <p>Your knowledge is someone's next big breakthrough.</p>
          <button onClick={() => navigate("My Learning")}>
            Explore learning <span>→</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => navigate("Settings")}>
            <Settings size={19} /> Settings
          </button>

          <button className="nav-item" onClick={logout}>
            <X size={19} />
            <span>Log out</span>
          </button>

          <div className="mini-profile">
            <div className="avatar blue mini-avatar">
              {getInitials(profileName)}
            </div>
            <button
              className="more-button"
              aria-label="Open profile"
              onClick={() => navigate("My Profile")}
            >
              ···
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              onClick={() => setMobileMenu(!mobileMenu)}
              aria-label="Toggle menu"
            >
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div>
              <div className="breadcrumb">Workspace <span>/</span> {page}</div>
              <h1>
                {page === "Discover" && "Discover your next match"}
                {page === "My Learning" && "Your learning journey"}
                {page === "Messages" && "Your connections"}
                {page === "My Profile" && "Your skill profile"}
                {page === "Settings" && "Settings"}
              </h1>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="online-pill"><span /> Open to learning</span>
            <button className="notification-button" aria-label="Notifications">
              <Bell size={19} />
              <i />
            </button>
            <button
              className="top-avatar"
              onClick={() => navigate("My Profile")}
              aria-label={`${profileName}'s profile`}
            >
              {getInitials(profileName)}
            </button>
          </div>
        </header>

        {page === "Discover" && (
          <>
            <section className="hero-banner">
              <div className="hero-copy">
                <div className="hero-eyebrow">
                  <Sparkles size={15} /> LEARNING, REIMAGINED
                </div>
                <h2>Share what you know.<br />Discover what you don't.</h2>
                <p>
                  Your next skill is just one conversation away.
                  Find people who complement your talents.
                </p>
                <button className="hero-cta" onClick={() => navigate("My Profile")}>
                  Complete your profile <span>→</span>
                </button>
              </div>

              <div className="hero-illustration" aria-hidden="true">
                <div className="hero-orbit orbit-a" />
                <div className="hero-orbit orbit-b" />
                <div className="hero-center"><ArrowRightLeft size={35} /></div>
                <div className="hero-float float-a"><BookOpen size={21} /></div>
                <div className="hero-float float-b"><Sparkles size={21} /></div>
                <div className="hero-float float-c"><Users size={21} /></div>
                <span className="hero-dot dot-a" />
                <span className="hero-dot dot-b" />
              </div>
            </section>

            <section className="stats-row">
              <div className="stat-card">
                <div className="stat-top"><span>Potential partners</span><Users size={18} /></div>
                <strong>{matches.length}</strong>
                <span className="stat-caption">Matching your search</span>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>Connection requests</span><ArrowRightLeft size={18} /></div>
                <strong>{connected.length.toString().padStart(2, "0")}</strong>
                <span className="stat-caption">Selected in this session</span>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>Your learning goals</span><BookOpen size={18} /></div>
                <strong>{skills.learn.length.toString().padStart(2, "0")}</strong>
                <span className="stat-caption">Skills you want to learn</span>
              </div>
            </section>

            <section className="discover-section" id="matches">
              <div className="section-header">
                <div>
                  <div className="section-title-row">
                    <h2>People you might love learning with</h2>
                    <span className="ai-pill"><Sparkles size={13} /> AI MATCHES</span>
                  </div>
                  <p>Based on complementary skills and learning goals</p>
                </div>
              </div>

              <label className="search-field">
                <Search size={19} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, role or skill..."
                />
                <kbd>⌘ K</kbd>
              </label>

              <div className="filter-row">
                {["All", "Figma", "React.js", "Python", "UI Design"].map((item) => (
                  <button
                    key={item}
                    className={`filter-chip ${filter === item ? "filter-selected" : ""}`}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
                <span className="result-count">{matches.length} people found</span>
              </div>

              <div className="match-grid">
                {matches.map((person) => (
                  <article className="match-card" key={person.id}>
                    <div className="match-card-top">
                      <Avatar person={person} />
                      <div className="match-score">
                        <span className="score-ring"><Sparkles size={13} /></span>
                        <strong>{person.score}%</strong>
                        <span>match</span>
                      </div>
                    </div>

                    <h3>{person.name}</h3>
                    <p className="person-role">{person.role}</p>

                    <div className="person-level">
                      <span className="level-dot" /> {person.level}
                    </div>

                    <div className="card-divider" />

                    <div className="skill-block">
                      <div className="skill-heading"><span className="skill-dot teach-dot" /> CAN TEACH</div>
                      <SkillTags skills={person.teaches} type="teach" />
                    </div>

                    <div className="skill-block">
                      <div className="skill-heading"><span className="skill-dot learn-dot" /> WANTS TO LEARN</div>
                      <SkillTags skills={person.learns} type="learn" />
                    </div>

                    <div className="match-explanation">
                      <Sparkles size={15} />
                      <span>
                        {person.teaches.some((s) => skills.learn.includes(s))
                          ? "Can teach a skill you want to learn"
                          : "Explore a complementary skill exchange"}
                      </span>
                    </div>

                    <div className="card-actions">
                      <button className="view-button" onClick={() => setSelected(person)}>
                        View profile
                      </button>
                      <button
                        className={`connect-button ${connected.includes(person.id) ? "is-connected" : ""}`}
                        onClick={() => toggleConnection(person.id)}
                        aria-label={`Connect with ${person.name}`}
                      >
                        {connected.includes(person.id) ? <Check size={18} /> : <Plus size={18} />}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {matches.length === 0 && (
                <div className="empty-state">
                  <Search size={30} />
                  <h3>No matching people found</h3>
                  <p>Try another skill or clear your search.</p>
                  <button onClick={() => { setSearch(""); setFilter("All"); }}>
                    Clear filters
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {page === "My Profile" && (
          <section className="page-panel">
            <div className="panel-heading">
              <div>
                <h2>Build your skill profile</h2>
                <p>Tell the community what you can teach and what you'd like to learn.</p>
              </div>
              <div className="profile-completion">PROFILE SETUP</div>
            </div>

            <div className="profile-edit-card">
              <div className="profile-cover" />
              <div className="profile-identity">
                <div className="avatar blue profile-avatar">
                  {getInitials(profileName)}
                </div>
                <div>
                  <h3>{profileName}</h3>
                  <p>Skill Explorer · Ready to exchange knowledge</p>
                </div>
              </div>
              <label className="form-label">
                Display name
                <input
                  className="text-input"
                  value={profileName}
                  onChange={(event) => { setProfileName(event.target.value); setSaved(false); }}
                  placeholder="Your name"
                />
              </label>

              <div className="profile-skills-grid">
                {[
                  { key: "teach", title: "Skills I can teach", color: "teach", subtitle: "Share your expertise" },
                  { key: "learn", title: "Skills I want to learn", color: "learn", subtitle: "Set your learning goals" },
                ].map((group) => (
                  <div className="editable-skill-card" key={group.key}>
                    <h3>{group.title}</h3>
                    <p>{group.subtitle}</p>
                    <div className="editable-tags">
                      {skills[group.key].map((skill) => (
                        <span className={`editable-tag ${group.color}`} key={skill}>
                          {skill}
                          <button onClick={() => removeSkill(group.key, skill)} aria-label={`Remove ${skill}`}>
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <form className="add-skill-form" onSubmit={addSkill}>
                      <input
                        value={skillType === group.key ? newSkill : ""}
                        onFocus={() => { setSkillType(group.key); setNewSkill(""); }}
                        onChange={(event) => { setSkillType(group.key); setNewSkill(event.target.value); }}
                        placeholder="Add a skill..."
                      />
                      <button type="submit" aria-label="Add skill"><Plus size={17} /></button>
                    </form>
                  </div>
                ))}
              </div>

              <button className="primary-button save-profile" onClick={() => setSaved(true)}>
                {saved ? <><Check size={17} /> Profile saved locally</> : "Save profile"}
              </button>
              <p className="form-note">Demo mode: your profile changes stay in this browser session.</p>
            </div>
          </section>
        )}

        {page === "My Learning" && (
          <section className="page-panel">
            <div className="panel-heading">
              <div>
                <h2>Your learning roadmap</h2>
                <p>A simple starting plan for your selected learning goals.</p>
              </div>
              <span className="ai-pill"><Sparkles size={14} /> AI ROADMAP DEMO</span>
            </div>

            <div className="roadmap-banner">
              <Sparkles size={24} />
              <div>
                <h3>Your web development journey</h3>
                <p>Build skills progressively with a project at every stage.</p>
              </div>
            </div>

            <div className="roadmap-list">
              {[
                ["Week 1", "HTML foundations", "Structure pages, forms, semantic elements."],
                ["Week 2", "CSS & responsive design", "Build responsive layouts, Flexbox and Grid."],
                ["Week 3", "JavaScript fundamentals", "Practice functions, arrays, events and DOM."],
                ["Week 4", "React essentials", "Create reusable components and stateful interfaces."],
              ].map(([week, title, description], index) => (
                <div className="roadmap-item" key={week}>
                  <div className={`roadmap-number ${index === 0 ? "roadmap-current" : ""}`}>
                    {index + 1}
                  </div>
                  <div className="roadmap-copy">
                    <span>{week}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                  <BookOpen size={19} className="roadmap-icon" />
                </div>
              ))}
            </div>
            <p className="form-note">Example roadmap only; connect an AI API to generate personalized plans.</p>
          </section>
        )}

        {page === "Messages" && (
          <section className="page-panel">
            <div className="panel-heading">
              <div>
                <h2>Your learning connections</h2>
                <p>People you've selected to connect with.</p>
              </div>
            </div>
            {connected.length === 0 ? (
              <div className="empty-state">
                <MessageCircle size={30} />
                <h3>Your conversations start here</h3>
                <p>Discover a partner and select the plus button to get started.</p>
                <button onClick={() => navigate("Discover")}>Discover partners</button>
              </div>
            ) : (
              <div className="connection-list">
                {initialMatches.filter((person) => connected.includes(person.id)).map((person) => (
                  <div className="connection-row" key={person.id}>
                    <Avatar person={person} />
                    <div className="connection-info">
                      <strong>{person.name}</strong>
                      <span>{person.role}</span>
                      <small>Connection selected · Chat not connected yet</small>
                    </div>
                    <button className="view-button" onClick={() => setSelected(person)}>View profile</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {page === "Settings" && (
          <section className="page-panel">
            <div className="panel-heading">
              <div>
                <h2>Settings</h2>
                <p>Basic preferences for your SkillSwap demo.</p>
              </div>
            </div>
            <div className="settings-card">
              <h3>Account profile</h3>
              <p>Your display name is currently {profileName}.</p>
              <button className="primary-button" onClick={() => navigate("My Profile")}>
                Edit profile
              </button>
            </div>
            <div className="settings-card">
              <h3>Demo data</h3>
              <p>Reset selected connections and search filters.</p>
              <button className="view-button" onClick={() => {
                setConnected([]);
                setSearch("");
                setFilter("All");
              }}>Reset dashboard</button>
            </div>
          </section>
        )}

        <footer className="app-footer">
          <span>© 2026 SkillSwap</span>
          <span>Built for learners, powered by community <Sparkles size={13} /></span>
        </footer>
      </main>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name}'s profile`}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">
              <X size={20} />
            </button>
            <div className="modal-cover" />
            <div className="modal-content">
              <div className="modal-person">
                <Avatar person={selected} large />
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.role}</p>
                  <span className="person-level"><span className="level-dot" /> {selected.level}</span>
                </div>
                <div className="modal-score">
                  <strong>{selected.score}%</strong>
                  <span>Compatibility</span>
                </div>
              </div>
              <p className="modal-bio">{selected.bio}</p>
              <div className="skill-block">
                <div className="skill-heading">CAN TEACH</div>
                <SkillTags skills={selected.teaches} type="teach" />
              </div>
              <div className="skill-block">
                <div className="skill-heading">WANTS TO LEARN</div>
                <SkillTags skills={selected.learns} type="learn" />
              </div>
              <div className="modal-explanation">
                <Sparkles size={18} />
                <div>
                  <strong>Why this match?</strong>
                  <p>This partner offers a potential exchange between teaching skills and learning goals. Confirm shared interests together.</p>
                </div>
              </div>
              <button
                className={`primary-button modal-connect ${connected.includes(selected.id) ? "modal-connected" : ""}`}
                onClick={() => toggleConnection(selected.id)}
              >
                {connected.includes(selected.id) ? <><Check size={18} /> Connection selected</> : <>Connect with {selected.name.split(" ")[0]} <ArrowRightLeft size={18} /></>}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
