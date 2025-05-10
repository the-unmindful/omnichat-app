// src/test-store.ts

// Test import - Does VS Code show an error here?
import Store from 'electron-store';

interface TestSchema {
    testValue: string;
    count?: number;
}

console.log('Attempting to initialize electron-store...');

// Test initialization - Does VS Code show errors on the 'new Store' line?
const testStoreInstance = new Store<TestSchema>({
    defaults: { testValue: 'initial' },
});

console.log('Store initialized.');

// Test accessing properties/methods - Do errors appear on these lines?
try {
    const storePath: string = testStoreInstance.path; // Test .path
    console.log('Store path:', storePath);

    testStoreInstance.set('testValue', 'modified'); // Test .set
    console.log('Set value.');

    const currentValue: string = testStoreInstance.get('testValue'); // Test .get
    console.log('Got value:', currentValue);

    testStoreInstance.set('count', 1);
    const currentCount: number | undefined = testStoreInstance.get('count'); // Test .get with optional
    console.log('Got count:', currentCount);

    testStoreInstance.delete('count'); // Test .delete
    console.log('Deleted count.');

} catch (e) {
    console.error("ERROR during store operation:", e);
}

console.log('Minimal store test script finished.');

// Keep this file simple - don't add IPC or Electron imports here for this test.