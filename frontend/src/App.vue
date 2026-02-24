<template>
  <div id="app">
    <header>
      <router-link to="/">
        <h1>Reduction Print Designer</h1>
      </router-link>
    </header>
    <main>
      <router-view />
    </main>
    <footer>&copy; 2026 Greg Hirson</footer>
  </div>
</template>

<style scoped>
header {
  padding: 1rem 2rem;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f8f8;
}
header a {
  text-decoration: none;
  color: inherit;
}
header h1 {
  margin: 0;
  font-size: 1.4rem;
}
main {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
footer {
  padding: 1.5rem 2rem;
  text-align: center;
  color: #999;
  font-size: 0.85rem;
  border-top: 1px solid #e0e0e0;
  margin-top: 2rem;
}
</style>
