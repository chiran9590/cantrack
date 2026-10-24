import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';

class LoginPage extends StatefulWidget {
  final void Function(User) onLogin;
  const LoginPage({super.key, required this.onLogin});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  late final TextEditingController _server =
      TextEditingController(text: Api.instance.baseUrl.isNotEmpty ? Api.instance.baseUrl : 'http://192.168.1.10:4000');
  final _email = TextEditingController();
  final _pw = TextEditingController();
  String _err = '';
  bool _busy = false;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _err = '';
    });
    try {
      final u = await Api.instance.login(_server.text, _email.text.trim(), _pw.text);
      widget.onLogin(u);
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _server.dispose();
    _email.dispose();
    _pw.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text.rich(TextSpan(children: [
                  TextSpan(text: 'Can'),
                  TextSpan(text: 'Track', style: TextStyle(color: kLime)),
                  TextSpan(text: ' 🌿'),
                ]), style: TextStyle(fontSize: 40, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                const Text('Sign in to start scanning', style: TextStyle(color: Colors.white60)),
                const SizedBox(height: 24),
                TextField(
                  controller: _server,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: inputDeco('Server address'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  decoration: inputDeco('Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pw,
                  obscureText: true,
                  onSubmitted: (_) => _busy ? null : _submit(),
                  decoration: inputDeco('Password'),
                ),
                if (_err.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_err, style: const TextStyle(color: kRed))),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 18)),
                  child: _busy
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Sign in', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
