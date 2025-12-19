# README.md

> before debug all example , please create .env file in the root

```
# .env
OPENAI_API_KEY=yours open ai key
DEEPSEEK_API_KEY=yours deepseek key
```

##  example
- langgraph_mcp/index.ts: langgraph mcp demo 
- langgraph
  - plan_execute_agent_custom: custom simple `plan adn execute` agent
  - plan_execute_agent_custom_task_limit: custom  max replant count  `plan adn execute` agent
  - plan_execute_agent_default: official  `plan adn execute` agent

## mcp example
> ./src/langgrah_mcp
```
step1: pnpm install
step2: npm install -g tsx
step3: tsx --watch ./src/langgrah_mcp/index.ts 
```


## langgraph ag-ui agent example
[langgraph-agui](./src/langgraph-agui/README.md)
