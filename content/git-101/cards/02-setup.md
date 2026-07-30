# 02 Set up and start

## How do you check whether Git is installed?

Run <b>git --version</b>. If it prints a version, the command is available. Install Git through your operating system or the instructions at [git-scm.com](https://git-scm.com/downloads) if it is missing.

## Which identity should you configure before committing?

Set <b>git config --global user.name "Your Name"</b> and <b>git config --global user.email "you@example.com"</b>. These become commit metadata; they are not login credentials.

## How do you make new repositories start on main?

Run <b>git config --global init.defaultBranch main</b>. The name <b>main</b> is a convention, not a special branch built into Git.

## How do you turn the current folder into a repository?

Run <b>git init</b>. Git creates a hidden <b>.git</b> directory and leaves your existing files in place as untracked files.

## How do you copy an existing repository and its history?

Run <b>git clone https://host.example/team/project.git</b>. Clone creates a new folder, downloads the repository, checks out a branch, and usually names the source remote <b>origin</b>.

## When do you use git init versus git clone?

Use <b>git init</b> to begin history for a local folder. Use <b>git clone</b> when a repository already exists elsewhere and you want a working copy of it.

## Why should you avoid a repository inside another repository?

The outer repository normally treats the inner repository as a special entry rather than ordinary files. Nested repositories are useful only when deliberately managed, such as with submodules.

## How do you ask Git for help on a command?

Run <b>git help commit</b>, <b>git commit --help</b>, or the shorter <b>git commit -h</b>. The first two open the full manual; <b>-h</b> prints a concise option summary.
