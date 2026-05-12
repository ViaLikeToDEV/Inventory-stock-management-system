import { useState } from 'react'
import { router, usePage } from '@inertiajs/react'

export default function Search({ profile, repos, username: initialUsername }) {
    const { errors } = usePage().props
    const [username, setUsername] = useState(initialUsername ?? '')
    const [loading, setLoading] = useState(false)

    function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)

        router.post(route('github.search'), { username }, {
            onFinish: () => setLoading(false),
        })
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>🐙 GitHub Profile Search</h1>

            {/* Search Form */}
            <form onSubmit={handleSubmit} style={styles.form}>
                <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="กรอก GitHub username..."
                    style={styles.input}
                />
                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
                </button>
            </form>

            {/* Error */}
            {errors.username && (
                <p style={styles.error}>⚠️ {errors.username}</p>
            )}

            {/* Profile Card */}
            {profile && (
                <>
                    <div style={styles.card}>
                        <img src={profile.avatar_url} alt={profile.login} style={styles.avatar} />
                        <div>
                            <h2 style={styles.name}>{profile.name ?? profile.login}</h2>
                            <p style={styles.login}>@{profile.login}</p>
                            {profile.bio && <p style={styles.bio}>{profile.bio}</p>}
                            {profile.location && <p>📍 {profile.location}</p>}
                            {profile.blog && (
                                <p>🔗 <a href={profile.blog} target="_blank" rel="noreferrer">{profile.blog}</a></p>
                            )}
                            <div style={styles.stats}>
                                <span>⭐ Repos: <strong>{profile.public_repos}</strong></span>
                                <span>👥 Followers: <strong>{profile.followers}</strong></span>
                                <span>➡️ Following: <strong>{profile.following}</strong></span>
                            </div>
                            <a href={profile.html_url} target="_blank" rel="noreferrer" style={styles.profileLink}>
                                ดูโปรไฟล์บน GitHub →
                            </a>
                        </div>
                    </div>

                    {/* Repos */}
                    {repos?.length > 0 && (
                        <>
                            <h3 style={styles.repoTitle}>📦 Repositories ล่าสุด</h3>
                            <div style={styles.repoGrid}>
                                {repos.map(repo => (

                                        <a key={repo.name}
                                        href={repo.html_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={styles.repoCard}
                                    >
                                        <p style={styles.repoName}>{repo.name}</p>
                                        {repo.description && (
                                            <p style={styles.repoDesc}>{repo.description}</p>
                                        )}
                                        <div style={styles.repoMeta}>
                                            {repo.language && <span>💻 {repo.language}</span>}
                                            <span>⭐ {repo.stargazers_count}</span>
                                            <span>🍴 {repo.forks_count}</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    )
}

const styles = {
    container: { maxWidth: 800, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' },
    title:     { fontSize: 28, marginBottom: 24 },
    form:      { display: 'flex', gap: 8, marginBottom: 16 },
    input:     { flex: 1, padding: '10px 14px', fontSize: 16, borderRadius: 8, border: '1px solid #ccc' },
    button:    { padding: '10px 20px', fontSize: 16, borderRadius: 8, background: '#2d333b', color: '#fff', border: 'none', cursor: 'pointer' },
    error:     { color: '#c0392b', marginBottom: 16 },
    card:      { display: 'flex', gap: 24, padding: 24, border: '1px solid #e1e4e8', borderRadius: 12, marginBottom: 24, alignItems: 'flex-start' },
    avatar:    { width: 100, height: 100, borderRadius: '50%' },
    name:      { fontSize: 22, margin: '0 0 4px' },
    login:     { color: '#57606a', margin: '0 0 8px' },
    bio:       { margin: '0 0 8px' },
    stats:     { display: 'flex', gap: 16, margin: '12px 0', flexWrap: 'wrap' },
    profileLink: { display: 'inline-block', marginTop: 8, color: '#0969da' },
    repoTitle: { fontSize: 18, marginBottom: 12 },
    repoGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 },
    repoCard:  { padding: 16, border: '1px solid #e1e4e8', borderRadius: 8, textDecoration: 'none', color: 'inherit', display: 'block' },
    repoName:  { fontWeight: 600, margin: '0 0 6px', color: '#0969da' },
    repoDesc:  { fontSize: 13, color: '#57606a', margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    repoMeta:  { display: 'flex', gap: 12, fontSize: 13, color: '#57606a' },
}
