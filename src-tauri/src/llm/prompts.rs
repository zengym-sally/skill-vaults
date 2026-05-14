pub fn skill_analysis_prompt(skill_content: &str) -> String {
    format!(
        r#"You are a skill analyzer. Analyze the following skill content and extract structured information.

Skill Content:
{skill_content}

Return ONLY a JSON object with the following structure, no extra text:
{{
    "skill_type": "One of: automation, integration, analysis, utility, workflow, other",
    "description": "Short concise description of what the skill does",
    "usage_instructions": "Step by step instructions on how to use this skill",
    "tags": ["Array of relevant tags/keywords"],
    "dependencies": ["Array of required dependencies, tools, or other skills"],
    "quality_score": "Integer 1-10, 10 being highest quality"
}}
"#,
        skill_content = skill_content
    )
}
