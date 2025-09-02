(() => {
    let currentSelectionValue = localStorage.getItem('deemphasisValue') || '500';
    let currentSelection = {
        'mpx': 'MPX',
        '0': '0 \u03Bcs',
        '500': '50 \u03Bcs',
        '750': '75 \u03Bcs',
    }[currentSelectionValue] || '50 \u03Bcs';

    let menuOpen = false;
    const socket = window.socket;
    if (!socket) {
        console.error('WebSocket global (window.socket) nu este definit!');
        return;
    }

    const DEEMPHASIS_CMD = {
        VALUES: {
            'mpx': 'B2',
            '0': 'D2',
            '500': 'D0',
            '750': 'D1'
        }
    };

    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'relative',
        width: '100px',
        margin: '0',
        userSelect: 'none',
        overflow: 'visible'
    });

    const mainButton = document.createElement('button');
    mainButton.textContent = currentSelection;
    Object.assign(mainButton.style, {
        width: '100%',
        height: '46px',
        fontSize: '14px',
        fontWeight: 'bold',
        border: 'none',
        cursor: 'pointer',
        padding: '0',
        textAlign: 'center',
        boxSizing: 'border-box',
        background: 'inherit',
        color: 'inherit'
    });

    const dropdown = document.createElement('div');
    dropdown.style.display = 'none';
    Object.assign(dropdown.style, {
        position: 'absolute',
        top: '46px',
        left: '0',
        width: '100%',
        zIndex: '10000',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        fontSize: '14px',
        textAlign: 'center',
        userSelect: 'none',
        boxSizing: 'border-box',
        backgroundColor: 'inherit',
        color: 'inherit'
    });

    const options = [
        { text: '50 \u03Bcs', value: '500' },
        { text: '75 \u03Bcs', value: '750' },
        { text: '0 \u03Bcs', value: '0' },
        { text: 'MPX', value: 'mpx' }
    ];

    function sendDeemphasisCommand(value) {
        if (socket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket nu este conectat.');
            return;
        }

        if (!DEEMPHASIS_CMD.VALUES.hasOwnProperty(value)) {
            console.error('Valoare necunoscuta pentru deemphasis:', value);
            return;
        }

        const commandString = DEEMPHASIS_CMD.VALUES[value];
        socket.send(commandString);
        console.log('Comanda TEF6686 trimisa:', commandString);

        // Trimite comanda B0 pentru 0, 500, 750
        if (['0', '500', '750'].includes(value)) {
            socket.send('B0');
            console.log('Comanda suplimentara trimisa: B0');
        }
    }

    function createDropdownItems() {
        dropdown.innerHTML = '';
        const textColor = getComputedStyle(mainButton).color;
        options.forEach(opt => {
            const item = document.createElement('div');
            item.textContent = opt.text;
            Object.assign(item.style, {
                padding: '10px',
                borderTop: '1px solid transparent',
                color: textColor,
                boxSizing: 'border-box',
                cursor: 'pointer'
            });
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = 'rgba(0,0,0,0.1)';
                item.style.borderTop = '1px solid rgba(0,0,0,0.2)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
                item.style.borderTop = '1px solid transparent';
            });
            item.onclick = () => {
                currentSelection = opt.text;
                currentSelectionValue = opt.value;
                mainButton.textContent = currentSelection;
                dropdown.style.display = 'none';
                menuOpen = false;
                localStorage.setItem('deemphasisValue', currentSelectionValue);
                sendDeemphasisCommand(currentSelectionValue);
            };
            dropdown.appendChild(item);
        });
    }

    mainButton.addEventListener('click', e => {
        e.stopPropagation();
        menuOpen = !menuOpen;
        dropdown.style.display = menuOpen ? 'block' : 'none';
    });

    document.addEventListener('click', () => {
        if (menuOpen) {
            dropdown.style.display = 'none';
            menuOpen = false;
        }
    });

    container.appendChild(mainButton);
    container.appendChild(dropdown);

    function updateColorsFromSkinBtn() {
        const skinBtn = document.querySelector('.button-ims button');
        if (!skinBtn) return;
        const cs = getComputedStyle(skinBtn);
        const background = cs.backgroundColor;
        const color = cs.color;
        container.style.background = background;
        container.style.color = color;
        mainButton.style.background = background;
        mainButton.style.color = color;
        dropdown.style.background = background;
        dropdown.style.color = color;
        createDropdownItems();
    }

    function integrate() {
        const parent = document.querySelector('.button-ims');
        if (parent && !document.getElementById('deemphasis-dropdown')) {
            container.id = 'deemphasis-dropdown';
            parent.parentNode.insertBefore(container, parent);
            retryUntilThemeApplied(updateColorsFromSkinBtn);
        }
    }

    function retryUntilThemeApplied(fn, tries = 10, delay = 100) {
        let lastBg = null;
        function attempt() {
            const btn = document.querySelector('.button-ims button');
            if (!btn) return;
            const cs = getComputedStyle(btn);
            if (cs.backgroundColor !== lastBg) {
                lastBg = cs.backgroundColor;
                fn();
            }
            if (tries-- > 0) {
                setTimeout(attempt, delay);
            }
        }
        attempt();
    }

    const observer = new MutationObserver(() => {
        retryUntilThemeApplied(updateColorsFromSkinBtn);
    });

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true
    });

    setTimeout(() => {
        integrate();
        sendDeemphasisCommand(currentSelectionValue);
    }, 500);
})();
