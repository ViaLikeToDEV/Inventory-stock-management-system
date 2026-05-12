<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class GithubController extends Controller
{
    public function index()
    {
        return Inertia::render('Github/Search');
    }

    public function search(Request $request)
    {
        $request->validate([
            'username' => 'required|string|max:100',
        ]);

        $username = $request->input('username');

        $response = Http::get("https://api.github.com/users/{$username}");

        if ($response->notFound()) {
            return back()->withErrors(['username' => 'ไม่พบ user นี้บน GitHub']);
        }

        if ($response->failed()) {
            return back()->withErrors(['username' => 'เกิดข้อผิดพลาด กรุณาลองใหม่']);
        }

        $user = $response->json();

        // ดึง repos เพิ่มเติม
        $reposResponse = Http::get("https://api.github.com/users/{$username}/repos");

        $repos = $reposResponse->successful() ? $reposResponse->json() : [];

        return Inertia::render('Github/Search', [
            'profile' => [
                'name'       => $user['name'],
                'login'      => $user['login'],
                'avatar_url' => $user['avatar_url'],
                'bio'        => $user['bio'],
                'followers'  => $user['followers'],
                'following'  => $user['following'],
                'public_repos' => $user['public_repos'],
                'html_url'   => $user['html_url'],
                'location'   => $user['location'],
                'blog'       => $user['blog'],
            ],
            'repos' => collect($repos)->map(fn($r) => [
                'name'        => $r['name'],
                'description' => $r['description'],
                'html_url'    => $r['html_url'],
                'language'    => $r['language'],
                'stargazers_count' => $r['stargazers_count'],
                'forks_count' => $r['forks_count'],
            ])->toArray(),
            'username' => $username,
        ]);
    }
}
